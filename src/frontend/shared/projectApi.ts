import { useProjectStore } from '@/frontend/shared/projectStore.ts';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';
import { makeSketch, makeFeature } from '@/cad/state/projectActions.ts';
import type { ProjectAction } from '@/cad/state/projectReducer.ts';
import {
  PlanegcsConstraint,
  OperationCategory,
  SketchPlane,
  SketchElement,
  Sketch,
  Feature,
  OperationParams,
  ShapeReference,
  FeatureRefEnrichment,
  SketchRefEnrichment,
  CADProject,
  createNewProject,
  compareBuildOrder,
} from '@/cad/types';

// Imperative operations on the CAD project. Plain module functions (not a React
// hook) that translate call-site intent into projectStore dispatches / action
// creators. Replaces useCADState's ~30 useCallback forwarders: these are
// referentially stable, need no per-method test (the reducer is tested), and
// are called directly by components and event handlers. Reactive reads live in
// useProjectState.ts; ephemeral UI actions live on viewportStore.
const dispatch = (action: ProjectAction) => useProjectStore.getState().dispatch(action);

export const projectApi = {
  // --- Sketches ----------------------------------------------------------
  addSketch(name: string, plane: SketchPlane): Sketch {
    const sketch = makeSketch(name, plane);
    dispatch({ type: 'ADD_SKETCH', sketch });
    return sketch;
  },
  updateSketchElements(sketchId: string, elements: SketchElement[]) {
    dispatch({ type: 'UPDATE_SKETCH_ELEMENTS', sketchId, elements });
  },
  updateSketchState(sketchId: string, sketch: Sketch) {
    dispatch({ type: 'UPDATE_SKETCH_STATE', sketchId, sketch });
  },
  addConstraint(sketchId: string, constraint: PlanegcsConstraint) {
    dispatch({ type: 'ADD_CONSTRAINT', sketchId, constraint });
  },
  removeConstraint(sketchId: string, constraintId: string) {
    dispatch({ type: 'REMOVE_CONSTRAINT', sketchId, constraintId });
  },
  updateSketchGeometry(sketchId: string, geometry: ShapeReference) {
    dispatch({ type: 'UPDATE_SKETCH_GEOMETRY', sketchId, geometry });
  },
  deleteSketch(sketchId: string) {
    dispatch({ type: 'DELETE_SKETCH', sketchId });
  },
  startSketchEdit(sketchId: string) {
    const v = useViewportStore.getState();
    v.setActiveSketchId(sketchId);
    v.setActiveTab(OperationCategory.SKETCH);
    // Open a fresh Tier-2 ephemeral undo/redo session for this sketch.
    useProjectStore.getState().beginSketchSession();
  },
  // Exit sketch mode. The reducer deletes the sketch if it's empty; the
  // ephemeral active-sketch id is always cleared. STOP_SKETCH_EDIT is dispatched
  // while the session is still active so it lands as a single timeline commit,
  // then the session (and its live undo/redo) is closed.
  stopSketchEdit() {
    const v = useViewportStore.getState();
    const sketchId = v.activeSketchId;
    if (sketchId) dispatch({ type: 'STOP_SKETCH_EDIT', sketchId });
    useProjectStore.getState().endSketchSession();
    v.setActiveSketchId(null);
  },

  // --- Features ----------------------------------------------------------
  addFeature(
    name: string,
    type: Feature['type'],
    parameters?: OperationParams,
    sketchId?: string,
    parentIds: string[] = []
  ): Feature {
    const feature = makeFeature(name, type, parameters, sketchId, parentIds);
    dispatch({ type: 'ADD_FEATURE', feature });
    return feature;
  },
  updateFeatureParameters(featureId: string, parameters: OperationParams) {
    dispatch({ type: 'UPDATE_FEATURE_PARAMETERS', featureId, parameters });
  },
  updateFeatureGeometry(featureId: string, geometry: ShapeReference) {
    dispatch({ type: 'UPDATE_FEATURE_GEOMETRY', featureId, geometry });
  },
  applyRefEnrichments(enrichments: FeatureRefEnrichment[]) {
    dispatch({ type: 'APPLY_REF_ENRICHMENTS', enrichments });
  },
  applySketchRefEnrichments(enrichments: SketchRefEnrichment[]) {
    dispatch({ type: 'APPLY_SKETCH_REF_ENRICHMENTS', enrichments });
  },
  toggleFeatureSuppression(featureId: string) {
    dispatch({ type: 'TOGGLE_FEATURE_SUPPRESSION', featureId });
  },
  toggleFeatureVisibility(featureId: string) {
    dispatch({ type: 'TOGGLE_FEATURE_VISIBILITY', featureId });
  },
  deleteFeature(featureId: string) {
    dispatch({ type: 'DELETE_FEATURE', featureId });
  },
  reorderFeature(featureId: string, newIndex: number) {
    dispatch({ type: 'REORDER_FEATURE', featureId, newIndex });
  },
  // Drop the dragged feature immediately before/after the target in build order.
  reorderFeatureRelative(draggedId: string, targetId: string, place: 'before' | 'after') {
    if (draggedId === targetId) return;
    const ordered = [...useProjectStore.getState().project.features].sort(compareBuildOrder);
    const without = ordered.filter((f) => f.id !== draggedId);
    const targetIndex = without.findIndex((f) => f.id === targetId);
    if (targetIndex === -1) return;
    projectApi.reorderFeature(draggedId, place === 'before' ? targetIndex : targetIndex + 1);
  },
  moveRollbackBar(newIndex: number) {
    dispatch({ type: 'MOVE_ROLLBACK_BAR', newIndex });
  },

  // --- Tree --------------------------------------------------------------
  selectTreeItem(id: string | null) {
    useViewportStore.getState().toggleSelectedTreeItem(id);
  },
  toggleTreeItemExpansion(id: string) {
    dispatch({ type: 'TOGGLE_TREE_ITEM_EXPANSION', id });
  },
  toggleTreeItemVisibility(id: string) {
    dispatch({ type: 'TOGGLE_TREE_ITEM_VISIBILITY', id });
  },
  editTreeItem(id: string) {
    useViewportStore.getState().setSelectedTreeItem(id);
    // TODO: Add edit modal or inline editing
    console.log('Edit item:', id);
  },
  deleteTreeItem(id: string) {
    dispatch({ type: 'DELETE_TREE_ITEM', id });
    if (useViewportStore.getState().selectedTreeItem === id) {
      useViewportStore.getState().setSelectedTreeItem(null);
    }
  },

  // --- Project-level -----------------------------------------------------
  saveProject() {
    dispatch({ type: 'TOUCH' });
  },
  newProject() {
    dispatch({ type: 'REPLACE', project: createNewProject() });
    const v = useViewportStore.getState();
    v.setSelectedTreeItem(null);
    v.setActiveOperation(null);
  },
  exportProject() {
    const project = useProjectStore.getState().project;
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportName = `${project.name.replace(/\s+/g, '_')}_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
  },
  importProject(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as CADProject;
        dispatch({ type: 'REPLACE', project: imported });
      } catch (error) {
        console.error('Failed to import project:', error);
      }
    };
    reader.readAsText(file);
  },

  // --- History -----------------------------------------------------------
  undo() {
    useProjectStore.getState().undo();
  },
  redo() {
    useProjectStore.getState().redo();
  },
  // Jump the version timeline to a stored version. Exits any sketch session
  // first so the restored project is authoritative.
  restoreVersion(id: string) {
    if (useViewportStore.getState().activeSketchId) projectApi.stopSketchEdit();
    useProjectStore.getState().restoreVersion(id);
  },
  clearHistory() {
    useProjectStore.getState().clearHistory();
  },
};
