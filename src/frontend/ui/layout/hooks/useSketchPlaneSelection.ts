import { useCallback, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import type { CADProject, Sketch, SketchPlane, Operation } from '@/cad/types';
import { PlaneType, ReferenceGeometryType, SketchOperation } from '@/cad/types';
import { SKETCH_TOOL_OPERATIONS } from '../ioOperations';

interface UseSketchPlaneSelectionArgs {
  project: CADProject;
  currentFeatureShapeId: string | null;
  getFaceGeometry: (faceId: number, shapeId: string) => void;
  setPendingSketchOnFace: (faceId: number | null) => void;
  addSketch: (name: string, plane: SketchPlane) => Sketch;
  startSketchEdit: (sketchId: string) => void;
  buildSketch: (sketch: Sketch) => void;
  activeSketchId: string | null;
  activeOperation: Operation | null;
  selectedFaceId: number | null;
  selectedEdgeIndex: number | null;
  selectedVertexIndex: number | null;
  selectedTreeItem: string | null;
  selectOperation: (operation: Operation | null) => void;
  handleFinishSketch: () => void;
}

// Everything to do with deciding which plane/face a new sketch attaches to:
// face-geometry-driven sketch creation, reference-plane sketch creation, the
// "awaiting a plane pick" gesture, and the Sketch toolbar button's dispatch logic.
export function useSketchPlaneSelection({
  project,
  currentFeatureShapeId,
  getFaceGeometry,
  setPendingSketchOnFace,
  addSketch,
  startSketchEdit,
  buildSketch,
  activeSketchId,
  activeOperation,
  selectedFaceId,
  selectedEdgeIndex,
  selectedVertexIndex,
  selectedTreeItem,
  selectOperation,
  handleFinishSketch,
}: UseSketchPlaneSelectionArgs) {
  // Request face geometry from the worker, then create a sketch on that face
  // (the sketch is created in the onFaceGeometry callback in useOpenCascadeBridge).
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

  // Handle sketch button click
  const handleSketchButtonClick = useCallback(() => {
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
  }, [activeSketchId, handleFinishSketch, selectedEdgeIndex, selectedVertexIndex, selectedFaceId, beginFaceSketch, selectedTreeItem, project.referenceGeometry, project.sketches, project.features, createSketchOnPlane, startSketchEdit, buildSketch]);

  return {
    beginFaceSketch,
    createSketchOnPlane,
    selectedReferencePlaneId,
    awaitingSketchPlane,
    handleCancelSketchPlane,
    handleSketchButtonClick,
  };
}
