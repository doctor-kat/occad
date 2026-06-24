import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/frontend/shared/useLocalStorage.ts';
import type { PlanegcsConstraint } from '@/cad/engine/sketch/constraintFactory';
import {
  CADProject,
  CADState,
  Operation,
  OperationCategory,
  Sketch,
  Feature,
  FeatureTreeItem,
  FeatureTreeItemType,
  SketchPlane,
  SketchElement,
  SketchElementType,
  OperationParams,
  ShapeReference,
  RebuildState,
  FeatureRefEnrichment,
  createNewProject,
  Workplane,
  Point3D,
  Vector3D,
  PlaneType,
  compareBuildOrder,
  orderKey
} from '@/cad/types';

/** Create a Workplane (gp_Ax3) from plane definition */
function createWorkplane(type: PlaneType, origin?: Point3D, normal?: Vector3D, offset: number = 0): Workplane {
  let finalOrigin: Point3D = origin || { x: 0, y: 0, z: 0 };
  let finalNormal: Vector3D = normal || { x: 0, y: 0, z: 1 };
  let xAxis: Vector3D = { x: 1, y: 0, z: 0 };
  let yAxis: Vector3D = { x: 0, y: 1, z: 0 };

  if (type === PlaneType.XY) {
    finalNormal = { x: 0, y: 0, z: 1 };
    xAxis = { x: 1, y: 0, z: 0 };
    yAxis = { x: 0, y: 1, z: 0 };
    finalOrigin = { x: 0, y: 0, z: offset };
  } else if (type === PlaneType.XZ) {
    finalNormal = { x: 0, y: 1, z: 0 };
    xAxis = { x: 1, y: 0, z: 0 };
    yAxis = { x: 0, y: 0, z: 1 };
    finalOrigin = { x: 0, y: offset, z: 0 };
  } else if (type === PlaneType.YZ) {
    finalNormal = { x: 1, y: 0, z: 0 };
    xAxis = { x: 0, y: 1, z: 0 };
    yAxis = { x: 0, y: 0, z: 1 };
    finalOrigin = { x: offset, y: 0, z: 0 };
  } else if (type === PlaneType.CUSTOM && normal) {
    // For custom planes, we need to derive xAxis and yAxis
    // Logic similar to OCC's gp_Ax2: choose an arbitrary X direction perpendicular to normal
    if (Math.abs(normal.x) < 0.9) {
      // Use (1,0,0) as reference
      const vx = 1, vy = 0, vz = 0;
      // Cross product: xAxis = reference X normal
      xAxis = {
        x: vy * normal.z - vz * normal.y,
        y: vz * normal.x - vx * normal.z,
        z: vx * normal.y - vy * normal.x
      };
    } else {
      // Use (0,1,0) as reference
      const vx = 0, vy = 1, vz = 0;
      xAxis = {
        x: vy * normal.z - vz * normal.y,
        y: vz * normal.x - vx * normal.z,
        z: vx * normal.y - vy * normal.x
      };
    }
    // Normalize xAxis
    const len = Math.sqrt(xAxis.x ** 2 + xAxis.y ** 2 + xAxis.z ** 2);
    xAxis = { x: xAxis.x / len, y: xAxis.y / len, z: xAxis.z / len };
    
    // yAxis = normal X xAxis
    yAxis = {
      x: normal.y * xAxis.z - normal.z * xAxis.y,
      y: normal.z * xAxis.x - normal.x * xAxis.z,
      z: normal.x * xAxis.y - normal.y * xAxis.x
    };
  }

  return { origin: finalOrigin, normal: finalNormal, xAxis, yAxis };
}

const STORAGE_KEY = 'occad-project';

/**
 * Smallest gap used when snapping a reordered feature to just after its
 * consumed sketch. In the epoch-ms ordering domain this is far below any real
 * timestamp granularity, so it slots the feature immediately after the sketch
 * without disturbing other items.
 */
const REORDER_EPSILON = 1e-6;

/** Migrate old persisted projects that lack isVisible on sketches and reference geometry */
function migrateProject(raw: CADProject): CADProject {
  const needsMigration = raw.sketches.some(
    (s) => (s as any).isVisible === undefined || s.points === undefined || s.constraints === undefined
  );

  if (!needsMigration) return raw;

  const sketchIdsUsedByFeatures = new Set(
    raw.features.map((f) => f.sketchId).filter(Boolean)
  );

  return {
    ...raw,
    sketches: raw.sketches.map((sketch) => {
      const newSketch = { ...sketch };
      if (newSketch.points === undefined) {
        newSketch.points = [];
      }
      if (newSketch.constraints === undefined) {
        newSketch.constraints = [];
      }
      if ((newSketch as any).isVisible === undefined) {
        // Respect legacy `visible` property if it exists
        if ((newSketch as any).visible !== undefined) {
          (newSketch as any).isVisible = !!(newSketch as any).visible;
        } else {
          // Default: consumed sketches hidden, standalone visible
          const isConsumed = sketchIdsUsedByFeatures.has(sketch.id);
          (newSketch as any).isVisible = !isConsumed;
        }
      }
      return newSketch;
    }),
    referenceGeometry: raw.referenceGeometry.map((ref) => {
      if ((ref as any).isVisible !== undefined) return ref;
      // Respect legacy `visible` property if it exists
      if ((ref as any).visible !== undefined) {
        return { ...ref, isVisible: !!(ref as any).visible };
      }
      // Default: reference geometry hidden
      return { ...ref, isVisible: false };
    }),
  };
}

export function useCADState() {
  const [rawProject, setProject] = useLocalStorage<CADProject>(STORAGE_KEY, createNewProject());
  const project = useMemo(() => migrateProject(rawProject), [rawProject]);
  const [activeTab, setActiveTab] = useState<OperationCategory>(OperationCategory.PRIMITIVES);
  const [activeOperation, setActiveOperation] = useState<Operation>(null);
  const [selectedTreeItem, setSelectedTreeItem] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSketchId, setActiveSketchId] = useState<string | null>(null);
  const [rebuildState, setRebuildState] = useState<RebuildState>({
    isRebuilding: false,
    progress: 0,
  });
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  // Build the feature tree structure (chronological order)
  const featureTree = useMemo((): FeatureTreeItem[] => {
    const tree: FeatureTreeItem[] = [];

    // Reference Geometry items always pinned at top
    project.referenceGeometry.forEach((ref) => {
      tree.push({
        id: ref.id,
        name: ref.name,
        type: FeatureTreeItemType.REFERENCE_GEOMETRY,
        visible: ref.isVisible,
        data: ref,
      });
    });

    // Collect standalone sketches and features into one array, sorted by createdAt
    const sketchIdsUsedByFeatures = new Set(
      project.features.map((f) => f.sketchId).filter(Boolean)
    );

    const chronologicalItems: { createdAt: number; item: FeatureTreeItem }[] = [];

    // Add standalone sketches (not attached to any feature)
    project.sketches
      .filter((sketch) => !sketchIdsUsedByFeatures.has(sketch.id))
      .forEach((sketch) => {
        chronologicalItems.push({
          createdAt: sketch.createdAt,
          item: {
            id: sketch.id,
            name: sketch.name,
            type: FeatureTreeItemType.SKETCH,
            visible: sketch.isVisible !== false,
            error: itemErrors[sketch.id],
            data: sketch,
          },
        });
      });

    // Add features (with their sketches as children)
    project.features.forEach((feature) => {
      const associatedSketch = project.sketches.find((s) => s.id === feature.sketchId);
      const featureItem: FeatureTreeItem = {
        id: feature.id,
        name: feature.name,
        type: FeatureTreeItemType.FEATURE,
        isExpanded: feature.isExpanded,
        visible: feature.isVisible !== false,
        error: itemErrors[feature.id],
        data: feature,
      };

      if (associatedSketch) {
        featureItem.children = [
          {
            id: associatedSketch.id,
            name: associatedSketch.name,
            type: FeatureTreeItemType.SKETCH,
            visible: associatedSketch.isVisible !== false,
            error: itemErrors[associatedSketch.id],
            data: associatedSketch,
          },
        ];
      }

      chronologicalItems.push({
        createdAt: feature.createdAt,
        item: featureItem,
      });
    });

    // Sort by the shared deterministic build order (sequence ?? createdAt, then
    // id) so the tree matches the worker's rebuild order exactly and never
    // depends on Array.sort stability. `item.data` is the sketch/feature.
    chronologicalItems.sort((a, b) => compareBuildOrder(a.item.data as any, b.item.data as any));
    chronologicalItems.forEach(({ item }) => tree.push(item));

    return tree;
  }, [project, itemErrors]);

  // Operation selection
  const selectOperation = useCallback((operation: Operation) => {
    setActiveOperation((current) => (current === operation ? null : operation));
  }, []);

  // Tab switching
  const switchTab = useCallback((tab: OperationCategory) => {
    setActiveTab(tab);
    setActiveOperation(null);
  }, []);

  // Tree item selection
  const selectTreeItem = useCallback((id: string | null) => {
    setSelectedTreeItem((current) => (current === id ? null : id));
  }, []);

  // Toggle tree item expansion
  const toggleTreeItemExpansion = useCallback((id: string) => {
    // Only features can be expanded/collapsed
    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      features: prev.features.map((f) =>
        f.id === id ? { ...f, isExpanded: !f.isExpanded } : f
      ),
    }));
  }, [setProject]);

  // Add a new sketch
  const addSketch = useCallback((name: string, plane: SketchPlane) => {
    const workplane = createWorkplane(plane.type, plane.origin, plane.normal, plane.offset || 0);

    const newSketch: Sketch = {
      id: crypto.randomUUID(),
      name,
      workplane,
      primitives: [],
      elements: [],
      constraints: [],
      visualMetadata: {},
      isClosed: false,
      isVisible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setProject((prev) => ({
      ...prev,
      version: prev.version + 1,
      updatedAt: Date.now(),
      sketches: [...prev.sketches, newSketch],
    }));

    return newSketch;
  }, [setProject]);

  // Update sketch elements
  const updateSketchElements = useCallback((sketchId: string, elements: SketchElement[]) => {
    setProject((prev) => {
      const sketch = prev.sketches.find((s) => s.id === sketchId);
      if (!sketch) return prev;

      const isClosed = checkIfSketchClosed(elements);

      return {
        ...prev,
        version: prev.version + 1,
        updatedAt: Date.now(),
        sketches: prev.sketches.map((s) =>
          s.id === sketchId
            ? {
                ...s,
                elements,
                isClosed,
                updatedAt: Date.now(),
              }
            : s
        ),
      };
    });
  }, [setProject]);

  // Update full sketch state (including solved primitives/constraints)
  const updateSketchState = useCallback((sketchId: string, updatedSketch: Sketch) => {
    // Derive isClosed from the elements rather than trusting the round-tripped
    // value: the worker's solver spreads back the sketch it received (which may
    // carry a stale isClosed), and replacing the sketch wholesale would otherwise
    // clobber the closure flag computed in updateSketchElements.
    const isClosed = checkIfSketchClosed(updatedSketch.elements);
    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      sketches: prev.sketches.map((s) =>
        s.id === sketchId ? { ...updatedSketch, isClosed, updatedAt: Date.now() } : s
      ),
    }));
  }, [setProject]);

  // Add a constraint to a sketch (planegcs-format object, e.g. from createConstraint()).
  // Bumps version so a rebuild re-runs the solver with the new constraint.
  const addConstraint = useCallback((sketchId: string, constraint: PlanegcsConstraint) => {
    setProject((prev) => {
      const sketch = prev.sketches.find((s) => s.id === sketchId);
      if (!sketch) return prev;
      return {
        ...prev,
        version: prev.version + 1,
        updatedAt: Date.now(),
        sketches: prev.sketches.map((s) =>
          s.id === sketchId
            ? { ...s, constraints: [...(s.constraints || []), constraint], updatedAt: Date.now() }
            : s
        ),
      };
    });
  }, [setProject]);

  // Remove a constraint from a sketch by id. Bumps version to re-solve.
  const removeConstraint = useCallback((sketchId: string, constraintId: string) => {
    setProject((prev) => {
      const sketch = prev.sketches.find((s) => s.id === sketchId);
      if (!sketch) return prev;
      return {
        ...prev,
        version: prev.version + 1,
        updatedAt: Date.now(),
        sketches: prev.sketches.map((s) =>
          s.id === sketchId
            ? { ...s, constraints: (s.constraints || []).filter((c: any) => c.id !== constraintId), updatedAt: Date.now() }
            : s
        ),
      };
    });
  }, [setProject]);

  // Update sketch geometry reference (after OpenCascade builds it)
  const updateSketchGeometry = useCallback((sketchId: string, geometry: ShapeReference) => {
    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      sketches: prev.sketches.map((sketch) =>
        sketch.id === sketchId ? { ...sketch, geometry, updatedAt: Date.now() } : sketch
      ),
    }));
  }, [setProject]);

  // Start editing a sketch (enters sketch mode)
  const startSketchEdit = useCallback((sketchId: string) => {
    setActiveSketchId(sketchId);
    setActiveTab(OperationCategory.SKETCH);
  }, []);

  // Stop editing sketch (exits sketch mode)
  // If the sketch has no elements, remove it from the project
  const stopSketchEdit = useCallback(() => {
    setActiveSketchId((currentSketchId) => {
      if (currentSketchId) {
        setProject((prev) => {
          const sketch = prev.sketches.find((s) => s.id === currentSketchId);
          if (sketch && (!sketch.elements || sketch.elements.length === 0) && (!sketch.primitives || sketch.primitives.length === 0)) {
            return {
              ...prev,
              version: prev.version + 1,
              updatedAt: Date.now(),
              sketches: prev.sketches.filter((s) => s.id !== currentSketchId),
            };
          }
          // Increment version even if not deleted so a rebuild is triggered to build the sketch geometry
          return {
            ...prev,
            version: prev.version + 1,
            updatedAt: Date.now(),
          };
        });
      }
      return null;
    });
  }, [setProject]);

  // Delete sketch
  const deleteSketch = useCallback((sketchId: string) => {
    setProject((prev) => ({
      ...prev,
      version: prev.version + 1,
      updatedAt: Date.now(),
      sketches: prev.sketches.filter((s) => s.id !== sketchId),
    }));
  }, [setProject]);

  // Add a new feature
  const addFeature = useCallback((
    name: string,
    type: Feature['type'],
    parameters?: OperationParams,
    sketchId?: string,
    parentIds: string[] = []
  ) => {
    const newFeature: Feature = {
      id: crypto.randomUUID(),
      name,
      type,
      sketchId,
      parameters,
      parentIds,
      isSuppressed: false,
      isVisible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isExpanded: true,
    };

    setProject((prev) => ({
      ...prev,
      version: prev.version + 1,
      updatedAt: Date.now(),
      features: [...prev.features, newFeature],
      // Auto-hide consumed sketch
      sketches: sketchId
        ? prev.sketches.map((s) =>
            s.id === sketchId ? { ...s, isVisible: false, updatedAt: Date.now() } : s
          )
        : prev.sketches,
    }));

    return newFeature;
  }, [setProject]);

  // Update feature parameters
  const updateFeatureParameters = useCallback((featureId: string, parameters: OperationParams) => {
    setProject((prev) => ({
      ...prev,
      version: prev.version + 1,
      updatedAt: Date.now(),
      features: prev.features.map((feature) =>
        feature.id === featureId
          ? { ...feature, parameters, updatedAt: Date.now() }
          : feature
      ),
    }));
  }, [setProject]);

  // Apply lazily-captured fingerprint upgrades for modification selections.
  // This is DERIVED data from a rebuild, not a user edit, so it must NOT bump
  // `version` — doing so would retrigger the rebuild and loop. The enrichment
  // converges after one rebuild (enrichRefs returns nothing once all refs carry
  // a fingerprint). See DETERMINISTIC.md step 3b.
  const applyRefEnrichments = useCallback((enrichments: FeatureRefEnrichment[]) => {
    if (!enrichments?.length) return;
    setProject((prev) => {
      let changed = false;
      const features = prev.features.map((feature) => {
        const ours = enrichments.filter((e) => e.featureId === feature.id);
        if (!ours.length || !feature.parameters) return feature;
        const parameters: any = { ...feature.parameters };
        for (const e of ours) parameters[e.key] = e.refs;
        changed = true;
        return { ...feature, parameters };
      });
      if (!changed) return prev;
      return { ...prev, features }; // intentionally no version / updatedAt bump
    });
  }, [setProject]);

  // Update feature geometry reference (after OpenCascade builds it)
  const updateFeatureGeometry = useCallback((featureId: string, geometry: ShapeReference) => {
    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      features: prev.features.map((feature) =>
        feature.id === featureId ? { ...feature, geometry, updatedAt: Date.now() } : feature
      ),
    }));
  }, [setProject]);

  // Toggle feature suppression (exclude from rebuild)
  const toggleFeatureSuppression = useCallback((featureId: string) => {
    setProject((prev) => ({
      ...prev,
      version: prev.version + 1,
      updatedAt: Date.now(),
      features: prev.features.map((feature) =>
        feature.id === featureId
          ? { ...feature, isSuppressed: !feature.isSuppressed, updatedAt: Date.now() }
          : feature
      ),
    }));
  }, [setProject]);

  // Toggle feature visibility
  const toggleFeatureVisibility = useCallback((featureId: string) => {
    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      features: prev.features.map((feature) =>
        feature.id === featureId ? { ...feature, isVisible: !feature.isVisible } : feature
      ),
    }));
  }, [setProject]);

  // Delete feature
  const deleteFeature = useCallback((featureId: string) => {
    setProject((prev) => ({
      ...prev,
      version: prev.version + 1,
      updatedAt: Date.now(),
      features: prev.features.filter((f) => f.id !== featureId),
    }));
  }, [setProject]);

  // Reorder a feature to position `newIndex` within the deterministic feature
  // sequence. Rather than reordering the array (which both the tree and the
  // worker ignore — they sort by orderKey), we assign the moved feature an
  // explicit `sequence` slotted between its new neighbours' keys. The same
  // (sequence ?? createdAt, id) order then reflects the move in both layers.
  const reorderFeature = useCallback((featureId: string, newIndex: number) => {
    setProject((prev) => {
      const ordered = [...prev.features].sort(compareBuildOrder);
      const moved = ordered.find((f) => f.id === featureId);
      if (!moved) return prev;

      const without = ordered.filter((f) => f.id !== featureId);
      const clamped = Math.max(0, Math.min(newIndex, without.length));
      const before = without[clamped - 1];
      const after = without[clamped];

      let sequence: number;
      if (!before && !after) sequence = orderKey(moved);          // only feature
      else if (!before) sequence = orderKey(after) - 1;            // to the front
      else if (!after) sequence = orderKey(before) + 1;            // to the back
      else sequence = (orderKey(before) + orderKey(after)) / 2;    // between two

      // Invariant: a feature must build after its consumed sketch, so its key
      // must stay strictly greater than that sketch's key. A feature can never
      // be moved before its own sketch; if the requested slot would do so, snap
      // it to immediately after the sketch instead.
      if (moved.sketchId) {
        const sketch = prev.sketches.find((s) => s.id === moved.sketchId);
        if (sketch) {
          const sketchKey = orderKey(sketch);
          if (sequence <= sketchKey) sequence = sketchKey + REORDER_EPSILON;
        }
      }

      return {
        ...prev,
        version: prev.version + 1,
        updatedAt: Date.now(),
        features: prev.features.map((f) =>
          f.id === featureId ? { ...f, sequence, updatedAt: Date.now() } : f
        ),
      };
    });
  }, [setProject]);

  // Save project
  const saveProject = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
    }));
  }, [setProject]);

  // Create new project
  const newProject = useCallback(() => {
    setProject(createNewProject());
    setSelectedTreeItem(null);
    setActiveOperation(null);
  }, [setProject]);

  // Export project as JSON
  const exportProject = useCallback(() => {
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportName = `${project.name.replace(/\s+/g, '_')}_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
  }, [project]);

  // Import project from JSON
  const importProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as CADProject;
        setProject(imported);
      } catch (error) {
        console.error('Failed to import project:', error);
      }
    };
    reader.readAsText(file);
  }, [setProject]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Update rebuild state
  const updateRebuildState = useCallback((state: Partial<RebuildState>) => {
    setRebuildState((prev) => ({ ...prev, ...state }));
  }, []);

  // Trigger rebuild (this will be called when project version changes)
  const triggerRebuild = useCallback(() => {
    setRebuildState({
      isRebuilding: true,
      progress: 0,
    });
  }, []);

  // Set an error on a specific tree item (sketch or feature)
  const setItemError = useCallback((itemId: string, message: string) => {
    setItemErrors((prev) => ({ ...prev, [itemId]: message }));
  }, []);

  // Clear all item errors (e.g. before a rebuild)
  const clearAllItemErrors = useCallback(() => {
    setItemErrors({});
  }, []);

  const toggleTreeItemVisibility = useCallback((id: string) => {
    setProject((prev) => {
      const updatedSketches = prev.sketches.map((sketch) =>
        sketch.id === id ? { ...sketch, isVisible: !sketch.isVisible } : sketch
      );

      const updatedFeatures = prev.features.map((feature) =>
        feature.id === id ? { ...feature, isVisible: !feature.isVisible } : feature
      );

      const updatedRefGeom = prev.referenceGeometry.map((ref) =>
        ref.id === id ? { ...ref, isVisible: !ref.isVisible } : ref
      );

      return {
        ...prev,
        sketches: updatedSketches,
        features: updatedFeatures,
        referenceGeometry: updatedRefGeom,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const editTreeItem = useCallback((id: string) => {
    // For now, just select the item - you can add more edit logic later
    setSelectedTreeItem(id);
    // TODO: Add edit modal or inline editing
    console.log('Edit item:', id);
  }, []);

  const deleteTreeItem = useCallback((id: string) => {
    setProject((prev) => {
      // Try to delete from sketches
      const filteredSketches = prev.sketches.filter((s) => s.id !== id);
      if (filteredSketches.length !== prev.sketches.length) {
        return {
          ...prev,
          sketches: filteredSketches,
          version: prev.version + 1,
          updatedAt: Date.now(),
        };
      }

      // Try to delete from features
      const filteredFeatures = prev.features.filter((f) => f.id !== id);
      if (filteredFeatures.length !== prev.features.length) {
        return {
          ...prev,
          features: filteredFeatures,
          version: prev.version + 1,
          updatedAt: Date.now(),
        };
      }

      // Reference geometry cannot be deleted
      return prev;
    });

    // Clear selection if deleted item was selected
    setSelectedTreeItem((current) => (current === id ? null : current));
  }, []);

  return {
    // State
    project,
    activeTab,
    activeOperation,
    selectedTreeItem,
    isSidebarOpen,
    activeSketchId,
    rebuildState,
    featureTree,

    // Actions
    selectOperation,
    switchTab,
    selectTreeItem,
    toggleTreeItemExpansion,
    toggleTreeItemVisibility,
    editTreeItem,
    deleteTreeItem,

    // Sketch actions
    addSketch,
    updateSketchElements,
    updateSketchState,
    addConstraint,
    removeConstraint,
    updateSketchGeometry,
    startSketchEdit,
    stopSketchEdit,
    deleteSketch,

    // Feature actions
    addFeature,
    updateFeatureParameters,
    updateFeatureGeometry,
    applyRefEnrichments,
    toggleFeatureSuppression,
    toggleFeatureVisibility,
    deleteFeature,
    reorderFeature,

    // Project actions
    saveProject,
    newProject,
    exportProject,
    importProject,

    // UI actions
    toggleSidebar,

    // Rebuild actions
    updateRebuildState,
    triggerRebuild,

    // Item error tracking
    setItemError,
    clearAllItemErrors,
  };
}

// Helper function to check if sketch elements form a closed wire
function checkIfSketchClosed(elements: SketchElement[]): boolean {
  if (elements.length === 0) {
    return false;
  }

  // For now, implement simple check: see if we have enough elements to form a closed shape
  // TODO: Implement proper wire closure check (first point == last point)

  // Rectangles and polygons are always closed
  const hasClosedElement = elements.some(
    (el) => el.type === SketchElementType.RECTANGLE || el.type === SketchElementType.CIRCLE || el.type === SketchElementType.ELLIPSE
  );

  if (hasClosedElement) return true;

  // For line-based sketches, check if first and last points match
  // This is a simplified check - in reality we'd need to properly trace the wire
  if (elements.length >= 3) {
    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];

    if (firstElement.type === SketchElementType.LINE && lastElement.type === SketchElementType.LINE) {
      const firstStart = firstElement.start;
      const lastEnd = lastElement.end;
      const tolerance = 0.001;

      return (
        Math.abs(firstStart.x - lastEnd.x) < tolerance &&
        Math.abs(firstStart.y - lastEnd.y) < tolerance
      );
    }
  }

  return false;
}