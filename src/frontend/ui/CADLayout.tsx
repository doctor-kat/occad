import { useRef, useEffect, useState, useCallback } from 'react';
import { Toolbar } from './Toolbar';
import { OperationsBar } from './operations/OperationsBar';
import { FeatureTree } from './FeatureTree/FeatureTree';
import { CADViewport } from '@/frontend/canvas/CADViewport';
import { OperationPanel } from './operations/OperationPanel';
import { EntitiesPanel } from './EntitiesPanel';
import { SketchEntitiesPanel } from './SketchEntitiesPanel';
import { useCADState } from '@/frontend/shared/useCADState';
import { useOpenCascade } from '@/worker/bridge/useOpenCascade';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { AppShell, Box, useMantineTheme, Tabs, Center, Tooltip, ActionIcon, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { FeatureTreeIcon, EntitiesIcon } from '@/frontend/shared/icons';
import type { Sketch, SketchElement, SketchPlane, ExtrudeParams, StableRef, SubShapeKind, Operation, ImportFormat, ImportParams, ExportFormat } from '@/cad/types';
import { SketchOperation, PlaneType, FeatureOperation, TransformOperation, OperationCategory, ReferenceGeometryType, EXPORT_EXTENSIONS } from '@/cad/types';
import { mapElementsToPrimitives } from '@/cad/engine/sketch/elementsToPrimitives';
import { syncElementsFromPrimitives } from '@/cad/engine/sketch/syncElementsFromPrimitives';
import { withOriginPrimitive, inferOriginCoincidence } from '@/cad/engine/sketch/originPoint';
import { inferAutoConstraints } from '@/cad/engine/sketch/autoConstraints';
import { createConstraint, type ConstraintInput } from '@/cad/engine/sketch/constraintFactory';
import { SketchConstraintToolbar } from './operations/SketchConstraintToolbar';
import { SketchConstraintList } from './operations/SketchConstraintList';

// Sketch drawing tools. Selecting one of these enters sketch mode rather than
// opening the OperationPanel.
const SKETCH_TOOL_OPERATIONS: SketchOperation[] = [
  SketchOperation.LINE,
  SketchOperation.RECTANGLE,
  SketchOperation.CIRCLE,
  SketchOperation.POLYGON,
  SketchOperation.ARC,
  SketchOperation.CENTERPOINT_ARC,
  SketchOperation.TANGENT_ARC,
  SketchOperation.PERIMETER_CIRCLE,
  SketchOperation.ELLIPSE,
  SketchOperation.BEZIER,
];

// I/O operation ids are `<direction>-<format>` (e.g. 'export-stl', 'import-step'),
// so the direction and format are derived from the id itself rather than a parallel
// lookup table. Guard against the known format unions so non-I/O ops that also
// contain a dash ('extrude-boss', 'revolved-cut') and disabled formats fall through.
const IMPORT_FORMATS: ImportFormat[] = ['step', 'iges', 'obj'];
const EXPORT_FORMATS: ExportFormat[] = ['step', 'iges', 'stl'];

type ParsedIoOperation =
  | { direction: 'import'; format: ImportFormat }
  | { direction: 'export'; format: ExportFormat }
  | null;

function parseIoOperation(op: string): ParsedIoOperation {
  const dash = op.indexOf('-');
  if (dash < 0) return null;
  const direction = op.slice(0, dash);
  const format = op.slice(dash + 1);
  if (direction === 'import' && (IMPORT_FORMATS as string[]).includes(format)) {
    return { direction, format: format as ImportFormat };
  }
  if (direction === 'export' && (EXPORT_FORMATS as string[]).includes(format)) {
    return { direction, format: format as ExportFormat };
  }
  return null;
}

export function CADLayout() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(164);
  const theme = useMantineTheme();
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>(OperationCategory.FEATURES);

  // Dynamically measure header height so sidebar/main offsets stay correct
  // even when the toolbar scrollbar appears (e.g. narrow Firefox windows)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0) setHeaderHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const {
    project,
    activeTab,
    activeOperation,
    selectedTreeItem,
    isSidebarOpen,
    activeSketchId,
    featureTree,
    selectOperation,
    switchTab,
    selectTreeItem,
    toggleTreeItemExpansion,
    toggleTreeItemVisibility,
    editTreeItem,
    deleteTreeItem,
    addSketch,
    addFeature,
    updateSketchElements,
    updateSketchState,
    addConstraint,
    removeConstraint,
    startSketchEdit,
    stopSketchEdit,
    updateFeatureParameters,
    applyRefEnrichments,
    applySketchRefEnrichments,
    undo,
    redo,
    canUndo,
    canRedo,
    saveProject,
    newProject,
    exportProject,
    importProject,
    toggleSidebar,
    setItemError,
    clearAllItemErrors,
  } = useCADState();

  // The currently-edited sketch, if any — looked up once and reused wherever the
  // active sketch's data (not just its id) is needed.
  const activeSketch = activeSketchId ? project.sketches.find((s) => s.id === activeSketchId) : undefined;

  // Viewport interaction state (from Zustand store)
  const pendingSketchOnFace = useViewportStore((state) => state.pendingSketchOnFace);
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);
  const setPendingSketchOnFace = useViewportStore((state) => state.setPendingSketchOnFace);
  const setSelectedFaceId = useViewportStore((state) => state.setSelectedFaceId);
  const setSelectedEdgeIndex = useViewportStore((state) => state.setSelectedEdgeIndex);
  const setSelectedVertexIndex = useViewportStore((state) => state.setSelectedVertexIndex);

  // Resolves to the pending Promise for each in-flight resolveSelector request
  // (see onSelectorResolved below / resolveSelectorAsync).
  const pendingSelectorResolutions = useRef(new Map<string, (refs: StableRef[]) => void>());

  // Export request → suggested download filename, keyed by requestId (resolved
  // in onExported above). Separate hidden input + pending format for CAD imports.
  const pendingExports = useRef(new Map<string, string>());
  const cadImportInputRef = useRef<HTMLInputElement>(null);
  const pendingImportFormat = useRef<ImportFormat | null>(null);

  // Single consolidated OpenCascade worker instance — shared by layout & viewport
  const {
    status: occStatus,
    progress: occProgress,
    error: occError,
    mesh: occMesh,
    retry: occRetry,
    rebuild,
    clearMesh,
    extrudeSketch,
    getFaceGeometry,
    resolveSelector,
    exportShape,
    currentFeatureShapeId,
    buildSketch,
    sketchEdges: occSketchEdges,
  } = useOpenCascade({
    onSketchBuilt: (sketchId, meshData, solvedSketch) => {
      if (solvedSketch) {
        // The solver only updates `primitives`; without this, `elements` (what
        // SketchOverlay renders) stays at its pre-solve position and a driving
        // dimension shows two copies of the shape — see syncElementsFromPrimitives.
        const synced = {
          ...solvedSketch,
          elements: syncElementsFromPrimitives(solvedSketch.elements, solvedSketch.primitives),
        };
        updateSketchState(sketchId, synced);
      }
    },
    onFeatureBuilt: (featureId, meshData) => {
      notifications.show({ color: 'green', message: 'Feature built successfully' });
    },
    onRebuildComplete: (meshData) => {
      notifications.show({ color: 'green', message: 'Rebuild complete' });
    },
    onFaceGeometry: (faceId, origin, normal, boundaryEdges) => {
      // Create sketch with the actual face geometry
      if (pendingSketchOnFace === faceId) {
        const plane: SketchPlane = {
          type: PlaneType.CUSTOM,
          planeRef: `face-${faceId}`,
          offset: 0,
          origin,
          normal,
        };

        const newSketch = addSketch(`Sketch ${project.sketches.length + 1}`, plane);
        
        // Import boundary edges as external fixed primitives
        if (boundaryEdges && boundaryEdges.length > 0) {
          const externalPrims = boundaryEdges.map(edgeTag => ({
            id: crypto.randomUUID(),
            type: 'line' as const, // Placeholder, worker will refine
            data: {},
            fixed: true,
            isExternal: true,
            sourceId: edgeTag
          }));
          const updatedSketch = {
            ...newSketch,
            primitives: externalPrims
          };
          updateSketchState(newSketch.id, updatedSketch);
          buildSketch(updatedSketch);
        }

        startSketchEdit(newSketch.id);
        selectTreeItem(newSketch.id);
        notifications.show({ color: 'blue', message: `Sketch created on Face ${faceId + 1} with ${boundaryEdges?.length || 0} imported edges` });
        setPendingSketchOnFace(null);
      }
    },
    onSelectorResolved: (requestId, refs) => {
      const resolve = pendingSelectorResolutions.current.get(requestId);
      if (resolve) {
        pendingSelectorResolutions.current.delete(requestId);
        resolve(refs);
      }
    },
    onExported: (requestId, format, content) => {
      // Trigger a browser download of the serialized file. The suggested name
      // was stashed against the requestId when the export was kicked off.
      const fileName = pendingExports.current.get(requestId) ?? `model.${EXPORT_EXTENSIONS[format]}`;
      pendingExports.current.delete(requestId);
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      notifications.show({ color: 'green', message: `Exported ${fileName}` });
    },
    onRefsEnriched: (enrichments) => {
      // Persist lazily-captured fingerprints (no version bump -> no rebuild loop).
      applyRefEnrichments(enrichments);
    },
    onSketchRefsEnriched: (enrichments) => {
      // Persist external-geometry fingerprints (no version bump). See step 3c.
      applySketchRefEnrichments(enrichments);
    },
    onError: (message, featureId) => {
      if (featureId) {
        setItemError(featureId, message);
      } else {
        notifications.show({
          color: 'red',
          title: 'Error',
          message: message,
        });
        setPendingSketchOnFace(null);
      }
    },
  });

  // Promise-based wrapper around the worker's request/response resolveSelector
  // bridge method, for the OperationPanel "select by rule" input (ROADMAP §9.1
  // Phase 3). Resolves to [] if there's no live body to select against yet.
  const resolveSelectorAsync = useCallback(
    (kind: SubShapeKind, selector: string): Promise<StableRef[]> => {
      if (!currentFeatureShapeId) return Promise.resolve([]);
      return new Promise((resolve) => {
        const requestId = crypto.randomUUID();
        pendingSelectorResolutions.current.set(requestId, resolve);
        resolveSelector(requestId, currentFeatureShapeId, kind, selector);
      });
    },
    [currentFeatureShapeId, resolveSelector]
  );

  // Track last rebuilt version / project ID (moved from OpenCascadeViewport)
  const lastRebuiltVersion = useRef<number>(0);
  const lastProjectId = useRef<string | null>(null);

  // Clear mesh when project ID changes (new project created)
  useEffect(() => {
    if (lastProjectId.current !== null && lastProjectId.current !== project.id) {
      clearMesh();
      lastRebuiltVersion.current = 0;
    }
    lastProjectId.current = project.id;
  }, [project.id, clearMesh]);

  // Trigger rebuild when project version changes OR on initial load with features.
  // Compare with `!==` (not `>`) so an undo — which restores a snapshot with a
  // LOWER version — still rebuilds. Versions are unique per recorded edit, so any
  // change between distinct states (forward edit, undo, or redo) means rebuild.
  useEffect(() => {
    if (occStatus !== 'ready') return;

    if (project.version !== lastRebuiltVersion.current) {
      lastRebuiltVersion.current = project.version;
      clearAllItemErrors();
      rebuild(project);
    }
  }, [project.id, project.version, occStatus, rebuild, project, clearAllItemErrors]);

  // Global undo/redo shortcuts: Ctrl/Cmd+Z, and Ctrl/Cmd+Shift+Z or Ctrl+Y for
  // redo. Suppressed while sketching (the SketchOverlay owns the keyboard) and
  // while typing into a field, so model history can't fire from a text edit.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      if (activeSketchId) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;

      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      e.preventDefault();
      if (isRedo) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, activeSketchId]);

  // Operation panel state
  const [operationPanelOpen, setOperationPanelOpen] = useState(false);
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);

  // Request face geometry from the worker, then create a sketch on that face
  // (the sketch is created in the onFaceGeometry callback above).
  const beginFaceSketch = useCallback((faceId: number) => {
    if (!currentFeatureShapeId) {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: 'No geometry available. Please create a feature first.',
      });
      return;
    }
    setPendingSketchOnFace(faceId);
    getFaceGeometry(faceId, currentFeatureShapeId);
    notifications.show({ color: 'blue', message: 'Extracting face geometry...' });
  }, [currentFeatureShapeId, setPendingSketchOnFace, getFaceGeometry]);

  // Create a new sketch on one of the standard reference planes and enter
  // sketch-edit mode.
  const createSketchOnPlane = useCallback((planeId: string) => {
    const selectedPlane = project.referenceGeometry.find((ref) => ref.id === planeId);
    if (!selectedPlane || selectedPlane.type !== ReferenceGeometryType.PLANE) return;

    let planeType: PlaneType = PlaneType.XY;
    if (selectedPlane.id === 'front-plane') planeType = PlaneType.XY;
    else if (selectedPlane.id === 'top-plane') planeType = PlaneType.XZ;
    else if (selectedPlane.id === 'right-plane') planeType = PlaneType.YZ;

    const plane: SketchPlane = { type: planeType, planeRef: selectedPlane.id, offset: 0 };
    const newSketch = addSketch(`Sketch ${project.sketches.length + 1}`, plane);
    startSketchEdit(newSketch.id);
    notifications.show({ color: 'blue', message: `Sketch created on ${selectedPlane.name}` });
  }, [project.referenceGeometry, project.sketches.length, addSketch, startSketchEdit]);

  // The id of the selected tree item when it is a reference plane (else null).
  // Kept as a primitive so it is stable across renders for use in effect deps.
  const selectedReferencePlaneId =
    project.referenceGeometry.find(
      (ref) => ref.id === selectedTreeItem && ref.type === ReferenceGeometryType.PLANE
    )?.id ?? null;

  // A sketch tool is active, we are not yet sketching, and nothing valid
  // (plane or face) is selected to sketch on. In this state we reveal all three
  // reference planes so the user always has something to click — important on a
  // brand-new document where no geometry exists yet.
  const awaitingSketchPlane =
    !activeSketchId &&
    !!activeOperation &&
    SKETCH_TOOL_OPERATIONS.includes(activeOperation as SketchOperation) &&
    selectedFaceId === null &&
    !selectedReferencePlaneId;

  // Open/close the OperationPanel for non-sketch operations. Kept separate from
  // the sketch-tool effect below so selection changes don't reset editing state.
  useEffect(() => {
    if (!activeOperation) {
      setOperationPanelOpen(false);
      return;
    }
    if (SKETCH_TOOL_OPERATIONS.includes(activeOperation as SketchOperation)) return;

    // For all other operations, open the OperationPanel
    setOperationPanelOpen(true);
    setEditingFeatureId(null);
    if (!isSidebarOpen) toggleSidebar();
  }, [activeOperation, isSidebarOpen, toggleSidebar]);

  // Enter sketch mode when a sketch tool is selected. Selecting a sketch tool no
  // longer auto-creates a sketch on the front plane — instead it starts a sketch
  // on whatever plane/face is selected, or (if nothing is selected) keeps the
  // user in plane-picking sketch mode until they click a plane or cancel.
  // selectedFaceId/selectedReferencePlaneId are dependencies, so clicking a
  // plane while awaiting re-runs this effect and starts the sketch.
  //
  // When nothing valid is selected we do NOT create a sketch and we do NOT fire
  // a transient toast. Instead `awaitingSketchPlane` (below) stays true, which
  // reveals all reference planes and shows a persistent in-viewport prompt that
  // remains until the user picks a plane/face or cancels (see CADViewport).
  useEffect(() => {
    if (!activeOperation) return;
    if (!SKETCH_TOOL_OPERATIONS.includes(activeOperation as SketchOperation)) return;
    // Already sketching — selecting a tool just changes the active draw tool.
    if (activeSketchId) return;

    // A face is selected → sketch on that face.
    if (selectedFaceId !== null) {
      beginFaceSketch(selectedFaceId);
      return;
    }

    // A reference plane is selected → sketch on that plane.
    if (selectedReferencePlaneId) {
      createSketchOnPlane(selectedReferencePlaneId);
      return;
    }

    // Nothing valid selected → remain in plane-picking sketch mode. The
    // persistent prompt + revealed planes are driven by `awaitingSketchPlane`.
  }, [activeOperation, activeSketchId, selectedFaceId, selectedReferencePlaneId, beginFaceSketch, createSketchOnPlane]);

  // Cancel plane-picking sketch mode: deselect the sketch tool. This clears
  // `activeOperation`, so `awaitingSketchPlane` becomes false and the prompt +
  // revealed planes disappear.
  const handleCancelSketchPlane = useCallback(() => {
    selectOperation(null);
  }, [selectOperation]);

  // While awaiting a sketch plane, Esc cancels the pending sketch (mirrors the
  // Cancel button in the viewport prompt). Sketch drawing has its own Esc
  // handling once a sketch is active, so this only runs before then.
  useEffect(() => {
    if (!awaitingSketchPlane) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancelSketchPlane();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [awaitingSketchPlane, handleCancelSketchPlane]);

  // Handle operation confirmation
  const handleOperationConfirm = (params: OperationParams, sketchId?: string) => {
    if (editingFeatureId) {
      // Update existing feature
      const feature = project.features.find((f) => f.id === editingFeatureId);
      if (feature) {
        updateFeatureParameters(editingFeatureId, params);
        notifications.show({ color: 'green', message: `${feature.name} updated` });
      }
    } else {
      // Create new feature
      let featureName = 'Feature';
      if (activeOperation) {
        // Map operation to a friendly name
        const opName = activeOperation.toString().split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).reverse().join('-');
        featureName = `${opName}${project.features.length + 1}`;
      }

      addFeature(
        featureName,
        activeOperation as FeatureOperation,
        params,
        sketchId,
        sketchId ? [sketchId] : []
      );
      notifications.show({ color: 'green', message: `${featureName} created` });
    }

    // A sketch-based feature consumes the active sketch, so leave sketch-edit
    // mode — otherwise the overlay stays open on top of the new solid.
    if (activeSketchId) {
      stopSketchEdit();
    }

    selectOperation(null);
    setOperationPanelOpen(false);
    setEditingFeatureId(null);
  };

  const handleOperationCancel = () => {
    selectOperation(null);
    setOperationPanelOpen(false);
    setEditingFeatureId(null);
  };

  // Override editTreeItem to support specific editing logic
  const handleEditTreeItem = (id: string) => {
    // Check if it's a sketch
    const sketch = project.sketches.find((s) => s.id === id);
    if (sketch) {
      startSketchEdit(id);
      // Re-solve on resume so `elements` (rendered by SketchOverlay) is synced with
      // `primitives` (rendered by SketchRenderer) — a sketch saved before a fix to
      // that sync, or edited in a session predating it, can otherwise show two
      // copies of a shape until something re-triggers a solve.
      buildSketch(sketch);
      notifications.show({ color: 'blue', message: `Editing ${sketch.name}` });
      return;
    }

    // Check if it's a feature
    const feature = project.features.find((f) => f.id === id);
    if (feature) {
      setEditingFeatureId(id);
      selectOperation(feature.type);
      setOperationPanelOpen(true);
      // Ensure sidebar is open
      if (!isSidebarOpen) toggleSidebar();
      return;
    }

    // Default to generic edit logic
    editTreeItem(id);
  };

  // Handle sketch update
  const handleUpdateSketch = (sketchId: string, elements: SketchElement[]) => {
    // First update local elements so UI reflects changes immediately if needed
    updateSketchElements(sketchId, elements);
    
    // Then trigger worker build/solve
    const sketch = project.sketches.find((s) => s.id === sketchId);
    if (sketch) {
      // Merge mapped primitives with existing ones (to keep external geometry)
      const newPrimitives = mapElementsToPrimitives(elements);
      const externalPrims = sketch.primitives.filter(p => p.isExternal);

      // Regenerate auto-constraints (e.g. a rectangle's H/V relations) from the
      // current elements every edit — deterministic ids make this idempotent.
      // Keep the user's manual constraints (untagged) and replace the inferred set.
      const manualConstraints = (sketch.constraints || []).filter((c: any) => !c.auto);
      // Auto-relations: a rectangle's H/V edges + coincidence for any endpoint/
      // corner/center snapped onto the origin (see originPoint.inferOriginCoincidence).
      const autoConstraints = [...inferAutoConstraints(elements), ...inferOriginCoincidence(elements)];

      buildSketch({
        ...sketch,
        elements,
        // Every sketch carries a fixed origin point primitive (the (0,0) of the
        // workplane) so geometry can be constrained to it; see originPoint.ts.
        primitives: withOriginPrimitive([...newPrimitives, ...externalPrims]),
        constraints: [...manualConstraints, ...autoConstraints],
      });
    }
  };

  // Delete a single entity from the active sketch (from the sidebar entity list).
  const handleRemoveSketchElement = (elementId: string) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    handleUpdateSketch(activeSketchId, sketch.elements.filter((el) => el.id !== elementId));
  };

  // While editing a sketch, surface its entity list in the left sidebar so the
  // selection (incl. box/crossing select) is visible. Switch to the Entities tab
  // on entering sketch mode and back to the feature tree on exit.
  useEffect(() => {
    setActiveSidebarTab(activeSketchId ? 'entities' : OperationCategory.FEATURES);
  }, [activeSketchId]);

  // Handle finish sketch
  const handleFinishSketch = () => {
    stopSketchEdit();
    selectOperation(null); // Deselect operation
    notifications.show({ color: 'green', message: 'Sketch completed' });
  };

  // Handle cancel sketch
  const handleCancelSketch = () => {
    stopSketchEdit();
    selectOperation(null); // Deselect operation
    notifications.show({ color: 'blue', message: 'Sketch cancelled' });
  };

  // Handle face click from viewport
  const handleFaceClick = (faceId: number) => {
    // Clear all other selections and set face selection
    selectTreeItem(null);
    setSelectedFaceId(faceId);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(null);
    // Switch to entities tab if not already there
    setActiveSidebarTab('entities');
  };

  // Handle edge click from viewport
  const handleEdgeClick = (edgeIndex: number) => {
    if (activeSketchId) {
      // If in sketch mode, import the edge as external geometry
      const sketch = project.sketches.find(s => s.id === activeSketchId);
      if (sketch) {
        const sourceId = `edge-${edgeIndex}`;
        if (!sketch.primitives.some(p => p.sourceId === sourceId)) {
          const newPrimitive = {
            id: crypto.randomUUID(),
            type: 'line' as const, // The worker will refine the type if needed
            data: {},
            fixed: true,
            isExternal: true,
            sourceId
          };
          const updatedSketch = {
            ...sketch,
            primitives: [...sketch.primitives, newPrimitive]
          };
          updateSketchState(activeSketchId, updatedSketch);
          buildSketch(updatedSketch);
          notifications.show({ color: 'blue', message: `Imported edge ${edgeIndex + 1} into sketch` });
        }
      }
      return;
    }

    // Clear all other selections and set edge selection
    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(edgeIndex);
    setSelectedVertexIndex(null);
    // Switch to entities tab if not already there
    setActiveSidebarTab('entities');
  };

  // Handle vertex click from viewport
  const handleVertexClick = (vertexIndex: number) => {
    if (activeSketchId) {
      // If in sketch mode, import the vertex as external geometry
      const sketch = project.sketches.find(s => s.id === activeSketchId);
      if (sketch) {
        const sourceId = `vertex-${vertexIndex}`;
        if (!sketch.primitives.some(p => p.sourceId === sourceId)) {
          const newPrimitive = {
            id: crypto.randomUUID(),
            type: 'point' as const,
            data: {},
            fixed: true,
            isExternal: true,
            sourceId
          };
          const updatedSketch = {
            ...sketch,
            primitives: [...sketch.primitives, newPrimitive]
          };
          updateSketchState(activeSketchId, updatedSketch);
          buildSketch(updatedSketch);
          notifications.show({ color: 'blue', message: `Imported vertex ${vertexIndex + 1} into sketch` });
        }
      }
      return;
    }

    // Clear all other selections and set vertex selection
    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(vertexIndex);
  };

  // Handle background click - clear all selections
  const handleBackgroundClick = () => {
    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(null);
  };

  // Handle sketch button click
  const handleSketchButtonClick = () => {
    // Toggle off: if already in sketch mode, finish/exit
    if (activeSketchId) {
      handleFinishSketch();
      return;
    }

    // Check if edge or vertex is selected (invalid for sketching)
    if (selectedEdgeIndex !== null || selectedVertexIndex !== null) {
      notifications.show({
        color: 'yellow',
        title: 'Invalid selection',
        message: 'Select a plane or face to create a sketch. Edges and vertices cannot be used for sketch creation.',
      });
      return;
    }

    // Check if a face is selected
    if (selectedFaceId !== null) {
      beginFaceSketch(selectedFaceId);
      return;
    }

    if (!selectedTreeItem) {
      // No selection - prompt user to select a plane or face
      notifications.show({
        color: 'yellow',
        title: 'Select a plane or face',
        message: 'Select a plane on which to create a sketch for the entity',
      });
      return;
    }

    // Check if selected item is a plane
    const selectedPlane = project.referenceGeometry.find((ref) => ref.id === selectedTreeItem);
    if (selectedPlane && selectedPlane.type === ReferenceGeometryType.PLANE) {
      createSketchOnPlane(selectedPlane.id);
      return;
    }

    // Check if selected item is a sketch
    const selectedSketch = project.sketches.find((s) => s.id === selectedTreeItem);
    if (selectedSketch) {
      // Edit the selected sketch (re-solve to sync elements/primitives — see handleEditTreeItem)
      startSketchEdit(selectedSketch.id);
      buildSketch(selectedSketch);
      notifications.show({ color: 'blue', message: `Editing ${selectedSketch.name}` });
      return;
    }

    // Check if selected item is a feature
    const selectedFeature = project.features.find((f) => f.id === selectedTreeItem);
    if (selectedFeature && selectedFeature.sketchId) {
      // Edit the sketch associated with the feature
      startSketchEdit(selectedFeature.sketchId);
      const sketch = project.sketches.find((s) => s.id === selectedFeature.sketchId);
      if (sketch) buildSketch(sketch);
      notifications.show({ color: 'blue', message: `Editing ${sketch?.name || 'sketch'}` });
      return;
    }

    // If we get here, the selected item is not valid for sketching
    notifications.show({
      color: 'yellow',
      title: 'Invalid selection',
      message: 'Select a plane, face, sketch, or feature to create or edit a sketch',
    });
  };

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importProject(file);
      notifications.show({ color: 'green', message: 'Project imported successfully' });
    }
    e.target.value = '';
  };

  // --- CAD import / export (ROADMAP §3) ---------------------------------------

  // Intercept I/O operations (they act immediately — no OperationPanel), and
  // pass everything else through to the normal operation selection.
  const handleOperationSelect = (operation: Operation) => {
    const io = operation ? parseIoOperation(operation as string) : null;
    if (io?.direction === 'import') {
      pendingImportFormat.current = io.format;
      cadImportInputRef.current?.click();
      return;
    }
    if (io?.direction === 'export') {
      handleCadExport(io.format);
      return;
    }
    selectOperation(operation);
  };

  const handleCadExport = (format: ExportFormat) => {
    if (!currentFeatureShapeId) {
      notifications.show({ color: 'red', title: 'Nothing to export', message: 'Build a feature first' });
      return;
    }
    const requestId = crypto.randomUUID();
    const baseName = (project.name || 'model').replace(/\s+/g, '_');
    pendingExports.current.set(requestId, `${baseName}.${EXPORT_EXTENSIONS[format]}`);
    exportShape(requestId, currentFeatureShapeId, format);
    notifications.show({ color: 'blue', message: `Exporting ${format.toUpperCase()}…` });
  };

  const handleCadImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const format = pendingImportFormat.current;
    e.target.value = '';
    pendingImportFormat.current = null;
    if (!file || !format) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      const params: ImportParams = { format, fileName: file.name, content };
      addFeature(`Import ${file.name}`, FeatureOperation.IMPORT, params);
      notifications.show({ color: 'green', message: `Imported ${file.name}` });
    };
    reader.onerror = () => {
      notifications.show({ color: 'red', title: 'Import failed', message: `Could not read ${file.name}` });
    };
    reader.readAsText(file);
  };

  const handleNew = () => {
    modals.openConfirmModal({
      title: 'Create New Project',
      children: 'Are you sure you want to create a new project? All unsaved changes will be lost.',
      labels: { confirm: 'Create New Project', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        newProject();
        notifications.show({ color: 'blue', message: 'New project created' });
      },
    });
  };

  const handleSave = () => {
    saveProject();
    notifications.show({ color: 'green', message: 'Project saved' });
  };

  const handleExport = () => {
    exportProject();
    notifications.show({ color: 'green', message: 'Project exported' });
  };

  // Apply a geometric constraint to the active sketch from the constraint toolbar.
  const handleApplyConstraint = (input: ConstraintInput) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    const constraint = createConstraint(crypto.randomUUID(), input);
    const updatedSketch = { ...sketch, constraints: [...(sketch.constraints || []), constraint] };
    addConstraint(activeSketchId, constraint); // persist + bump version
    buildSketch(updatedSketch);                // re-solve with the new constraint
    notifications.show({ color: 'blue', message: `Applied ${input.kind} constraint` });
    // The Dimension tool (SketchOperation.DIMENSION) is a two-click pick-and-create
    // gesture, not a toggleable multi-use mode like the constraint toolbar buttons —
    // once it's produced a dimension, drop back to selection instead of staying armed
    // for another pick.
    if (input.kind === 'distance' || input.kind === 'horizontal-distance' || input.kind === 'vertical-distance' || input.kind === 'point-line-distance') {
      selectOperation(null);
    }
  };

  // Remove a constraint from the active sketch and re-solve.
  const handleRemoveConstraint = (constraintId: string) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    const updatedSketch = { ...sketch, constraints: (sketch.constraints || []).filter((c: any) => c.id !== constraintId) };
    removeConstraint(activeSketchId, constraintId);
    buildSketch(updatedSketch);
  };

  // Handle constraint value update
  const handleUpdateConstraintValue = (constraintId: string, value: number) => {
    if (activeSketchId) {
      const sketch = project.sketches.find((s) => s.id === activeSketchId);
      if (sketch) {
        const updatedConstraints = sketch.constraints.map((c) => {
          if (c.id === constraintId) {
            // Update the value based on constraint type
            if ('distance' in c) return { ...c, distance: value };
            if ('difference' in c) return { ...c, difference: value };
            if ('radius' in c) return { ...c, radius: value };
            if ('angle' in c) return { ...c, angle: value };
          }
          return c;
        });
        const updatedSketch = { ...sketch, constraints: updatedConstraints };
        updateSketchState(activeSketchId, updatedSketch);
        buildSketch(updatedSketch);
      }
    }
  };

  // Pure display-metadata update (no re-solve needed) shared by the dimension-label-drag
  // and arrow-flip handlers, which otherwise differed only in what patch they applied.
  const patchVisualMetadata = (
    constraintId: string,
    patch: (meta: Sketch['visualMetadata'][string] | undefined) => Partial<Sketch['visualMetadata'][string]>,
  ) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    const meta = sketch.visualMetadata[constraintId];
    const updatedSketch = {
      ...sketch,
      visualMetadata: {
        ...sketch.visualMetadata,
        [constraintId]: { ...meta, ...patch(meta) },
      },
    };
    updateSketchState(activeSketchId, updatedSketch);
  };

  // Handle dragging a dimension label.
  const handleUpdateLabelOffset = (constraintId: string, offset: { x: number; y: number }) =>
    patchVisualMetadata(constraintId, () => ({ labelOffset: offset }));

  // Handle clicking a dimension's arrowhead — flips both arrows together between
  // pointing inward (default) and outward.
  const handleToggleArrowFlip = (constraintId: string) =>
    patchVisualMetadata(constraintId, (meta) => ({ arrowFlip: !meta?.arrowFlip }));

  return (
    <AppShell
      header={{ height: headerHeight }}
      navbar={{
        width: isSidebarOpen ? 256 : 56,
        breakpoint: 0, // Never auto-collapse based on breakpoint
      }}
      padding={0}
      style={{
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: theme.other.colors.background,
      }}
    >
      {/* Hidden file input for project (.json) import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Hidden file input for CAD geometry import (STEP / IGES / OBJ) */}
      <input
        ref={cadImportInputRef}
        type="file"
        accept=".step,.stp,.iges,.igs,.obj"
        style={{ display: 'none' }}
        onChange={handleCadImportFileChange}
      />

      {/* Combined Header: Toolbar + OperationsBar */}
      <AppShell.Header
        style={{
          border: 'none',
          backgroundColor: theme.other.colors.cadHeader,
        }}
      >
        <Box ref={headerRef}>
          <Toolbar
            projectName={project.name}
            onNew={handleNew}
            onOpen={handleOpen}
            onSave={handleSave}
            onExport={handleExport}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          <OperationsBar
            activeTab={activeTab}
            activeOperation={activeOperation}
            selectedTreeItem={selectedTreeItem}
            activeSketchId={activeSketchId}
            onTabChange={switchTab}
            onOperationSelect={handleOperationSelect}
            onSketchButtonClick={handleSketchButtonClick}
          />
        </Box>
      </AppShell.Header>

      {/* Left Sidebar - Dynamic Panel */}
            <AppShell.Navbar
              style={{
                borderRight: `1px solid ${theme.other.colors.border}`,
                backgroundColor: theme.other.colors.sidebarBackground,
                transition: 'all 300ms ease-in-out',
                overflow: 'hidden',
              }}
            >
              <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {operationPanelOpen && activeOperation && (
                  <Box style={{ 
                    flexShrink: 0, 
                    maxHeight: '60%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderBottom: `2px solid ${theme.other.colors.border}`,
                    zIndex: 5
                  }}>
                    <OperationPanel
                      title={editingFeatureId ? `Edit ${project.features.find(f => f.id === editingFeatureId)?.name}` : activeOperation.toString().split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
                      operation={activeOperation as FeatureOperation | TransformOperation | SketchOperation}
                      project={project}
                      initialParams={editingFeatureId ? (project.features.find(f => f.id === editingFeatureId)?.parameters) : undefined}
                      initialSketchId={editingFeatureId ? (project.features.find(f => f.id === editingFeatureId)?.sketchId) : undefined}
                      selectedTreeItem={selectedTreeItem}
                      onResolveSelector={resolveSelectorAsync}
                      onConfirm={handleOperationConfirm}
                      onCancel={handleOperationCancel}
                    />
                  </Box>
                )}
                
                <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Tabs
                    variant="unstyled"
                    value={activeSidebarTab}
                    onChange={setActiveSidebarTab}
                    styles={{
                      root: { display: 'flex', flexDirection: 'column', height: '100%' },
                      panel: { flex: 1, overflow: 'hidden' },
                      list: {
                        display: 'flex',
                        padding: 0,
                        borderBottom: `1px solid ${theme.other.colors.sidebarBorder}`,
                        backgroundColor: theme.other.colors.sidebarBackground,
                        gap: 0,
                        marginTop: 8, // Add gap between toolbar and sidebar tabs
                        borderTop: `1px solid ${theme.other.colors.sidebarBorder}`, // Add top border for distinction
                      },
                      tab: {
                        flex: isSidebarOpen ? 1 : 'none',
                        height: 36, // Slightly shorter tabs for a more "panel" look
                        borderBottom: '2px solid transparent',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.other.colors.mutedForeground,
                        transition: 'all 200ms',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                      }
                    }}
                  >
                    <Tabs.List>
                      <Tabs.Tab
                        value={OperationCategory.FEATURES}
                        data-testid="feature-tree-tab"
                        style={{
                          // Ensure transition is smooth
                          transition: 'background-color 200ms, border-color 200ms, color 200ms',
                          ...(activeSidebarTab === OperationCategory.FEATURES && {
                            color: theme.colors.blue[5],
                            borderBottomColor: theme.colors.blue[5],
                            backgroundColor: `${theme.colors.blue[5]}15`,
                          })
                        }}
                      >                        {isSidebarOpen ? (
                          <Group gap={6} wrap="nowrap">
                            <FeatureTreeIcon size={16} />
                            <span>Feature Tree</span>
                          </Group>
                        ) : (
                          <Tooltip label="Feature Tree" position="right">
                            <Center><FeatureTreeIcon size={20} /></Center>
                          </Tooltip>
                        )}
                      </Tabs.Tab>
                      <Tabs.Tab
                        value="entities"
                        data-testid="entities-tab"
                        style={{
                          transition: 'background-color 200ms, border-color 200ms, color 200ms',
                          ...(activeSidebarTab === 'entities' && {
                            color: theme.colors.blue[5],
                            borderBottomColor: theme.colors.blue[5],
                            backgroundColor: `${theme.colors.blue[5]}15`,
                          })
                        }}
                      >
                        {isSidebarOpen ? (
                          <Group gap={6} wrap="nowrap">
                            <EntitiesIcon size={16} />
                            <span>Entities</span>
                          </Group>
                        ) : (
                          <Tooltip label="Entities" position="right">
                            <Center><EntitiesIcon size={20} /></Center>
                          </Tooltip>
                        )}
                      </Tabs.Tab>
      
                      {!isSidebarOpen && (
                        <Box mt="auto" px={8} pb={8} style={{ width: '100%' }}>
                          <Tooltip label="Expand Sidebar" position="right">
                            <ActionIcon variant="subtle" color="gray" onClick={toggleSidebar} w="100%" h={40}>
                              <FeatureTreeIcon size={20} />
                            </ActionIcon>
                          </Tooltip>
                        </Box>
                      )}
                    </Tabs.List>
      
                    <Tabs.Panel value={OperationCategory.FEATURES}>
                      <FeatureTree
                        items={featureTree}
                        selectedItem={selectedTreeItem}
                        onSelectItem={(id) => {
                          selectTreeItem(id);
                          // Clear geometry selections when selecting from tree
                          setSelectedFaceId(null);
                          setSelectedEdgeIndex(null);
                          setSelectedVertexIndex(null);
                        }}
                        onToggleExpand={toggleTreeItemExpansion}
                        onToggleVisibility={toggleTreeItemVisibility}
                        onEdit={handleEditTreeItem}
                        onDelete={deleteTreeItem}
                        isCompact={!isSidebarOpen}
                        onToggleSidebar={toggleSidebar}
                      />
                    </Tabs.Panel>
                    <Tabs.Panel value="entities">
                      {!isSidebarOpen ? (
                        <Stack gap={4} p={8} align="center">
                          <Tooltip label="Faces" position="right">
                            <ActionIcon variant="subtle" size="lg">
                              <EntitiesIcon size={20} />
                            </ActionIcon>
                          </Tooltip>
                        </Stack>
                      ) : activeSketchId ? (
                        activeSketch ? (
                          <SketchEntitiesPanel
                            sketch={activeSketch}
                            onRemoveElement={handleRemoveSketchElement}
                          />
                        ) : null
                      ) : (
                        <EntitiesPanel
                          mesh={occMesh}
                          onFaceClick={handleFaceClick}
                          onEdgeClick={handleEdgeClick}
                        />
                      )}
                    </Tabs.Panel>
            </Tabs>
          </Box>
        </Box>
      </AppShell.Navbar>

      {/* Main Canvas Area */}
      <AppShell.Main
        style={{
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <Box pos="relative" w="100%" h="100%">
          <CADViewport
            project={project}
            activeSketchId={activeSketchId}
            activeOperation={activeOperation as SketchOperation}
            selectedTreeItem={selectedTreeItem}
            awaitingSketchPlane={awaitingSketchPlane}
            onCancelSketchPlane={handleCancelSketchPlane}
            occStatus={occStatus}
            occProgress={occProgress}
            occError={occError}
            occMesh={occMesh}
            occSketchEdges={occSketchEdges}
            occRetry={occRetry}
            onUpdateSketch={handleUpdateSketch}
            onFinishSketch={handleFinishSketch}
            onCancelSketch={handleCancelSketch}
            onPlaneClick={(planeId) => {
              selectTreeItem(planeId);
              setSelectedFaceId(null);
              setSelectedEdgeIndex(null);
              setSelectedVertexIndex(null);
            }}
            onSketchClick={(sketchId) => {
              selectTreeItem(sketchId);
              setSelectedFaceId(null);
              setSelectedEdgeIndex(null);
              setSelectedVertexIndex(null);
            }}
            onFaceClick={handleFaceClick}
            onEdgeClick={handleEdgeClick}
            onVertexClick={handleVertexClick}
            onBackgroundClick={handleBackgroundClick}
            onUpdateConstraintValue={handleUpdateConstraintValue}
            onCreateConstraint={handleApplyConstraint}
            onUpdateLabelOffset={handleUpdateLabelOffset}
            onToggleArrowFlip={handleToggleArrowFlip}
          />
          {activeSketchId && activeSketch && (
            <>
              <SketchConstraintToolbar sketch={activeSketch} onApply={handleApplyConstraint} />
              <SketchConstraintList sketch={activeSketch} onRemove={handleRemoveConstraint} />
            </>
          )}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}