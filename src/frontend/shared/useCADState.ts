import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/frontend/shared/useLocalStorage.ts';
import {
  CADProject,
  CADState,
  Tool,
  ToolCategory,
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
  createNewProject
} from '@/cad/types';

const STORAGE_KEY = 'occad-project';

/** Migrate old persisted projects that lack isVisible on sketches and reference geometry */
function migrateProject(raw: CADProject): CADProject {
  const needsSketchMigration = raw.sketches.some(
    (s) => (s as any).isVisible === undefined
  );
  const needsRefGeomMigration = raw.referenceGeometry.some(
    (r) => (r as any).isVisible === undefined
  );

  if (!needsSketchMigration && !needsRefGeomMigration) return raw;

  const sketchIdsUsedByFeatures = new Set(
    raw.features.map((f) => f.sketchId).filter(Boolean)
  );

  return {
    ...raw,
    sketches: raw.sketches.map((sketch) => {
      if ((sketch as any).isVisible !== undefined) return sketch;
      // Respect legacy `visible` property if it exists
      if ((sketch as any).visible !== undefined) {
        return { ...sketch, isVisible: !!(sketch as any).visible };
      }
      // Default: consumed sketches hidden, standalone visible
      const isConsumed = sketchIdsUsedByFeatures.has(sketch.id);
      return { ...sketch, isVisible: !isConsumed };
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
  const [activeTab, setActiveTab] = useState<ToolCategory>(ToolCategory.FEATURES);
  const [activeTool, setActiveTool] = useState<Tool>(null);
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

    // Sort by createdAt ascending and append to tree
    chronologicalItems.sort((a, b) => a.createdAt - b.createdAt);
    chronologicalItems.forEach(({ item }) => tree.push(item));

    return tree;
  }, [project, itemErrors]);

  // Tool selection
  const selectTool = useCallback((tool: Tool) => {
    setActiveTool((current) => (current === tool ? null : tool));
  }, []);

  // Tab switching
  const switchTab = useCallback((tab: ToolCategory) => {
    setActiveTab(tab);
    setActiveTool(null);
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
    const newSketch: Sketch = {
      id: crypto.randomUUID(),
      name,
      plane,
      elements: [],
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
    const isClosed = checkIfSketchClosed(elements);

    setProject((prev) => ({
      ...prev,
      version: prev.version + 1,
      updatedAt: Date.now(),
      sketches: prev.sketches.map((sketch) =>
        sketch.id === sketchId
          ? {
              ...sketch,
              elements,
              updatedAt: Date.now(),
              // Check if sketch forms closed wire (simple check - first/last points match)
              isClosed
            }
          : sketch
      ),
    }));
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
    setActiveTab(ToolCategory.SKETCH);
  }, []);

  // Stop editing sketch (exits sketch mode)
  // If the sketch has no elements, remove it from the project
  const stopSketchEdit = useCallback(() => {
    setActiveSketchId((currentSketchId) => {
      if (currentSketchId) {
        setProject((prev) => {
          const sketch = prev.sketches.find((s) => s.id === currentSketchId);
          if (sketch && sketch.elements.length === 0) {
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

  // Reorder features (for managing build order)
  const reorderFeature = useCallback((featureId: string, newIndex: number) => {
    setProject((prev) => {
      const features = [...prev.features];
      const currentIndex = features.findIndex((f) => f.id === featureId);
      if (currentIndex === -1) return prev;

      const [removed] = features.splice(currentIndex, 1);
      features.splice(newIndex, 0, removed);

      return {
        ...prev,
        version: prev.version + 1,
        updatedAt: Date.now(),
        features,
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
    setActiveTool(null);
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
    activeTool,
    selectedTreeItem,
    isSidebarOpen,
    activeSketchId,
    rebuildState,
    featureTree,

    // Actions
    selectTool,
    switchTab,
    selectTreeItem,
    toggleTreeItemExpansion,
    toggleTreeItemVisibility,
    editTreeItem,
    deleteTreeItem,

    // Sketch actions
    addSketch,
    updateSketchElements,
    updateSketchGeometry,
    startSketchEdit,
    stopSketchEdit,
    deleteSketch,

    // Feature actions
    addFeature,
    updateFeatureParameters,
    updateFeatureGeometry,
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