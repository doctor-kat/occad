import { useCallback, useMemo } from 'react';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';
import { useProjectStore } from '@/frontend/shared/projectStore.ts';
import { buildFeatureTree, rollbackBarIndexOf } from '@/cad/state/projectSelectors.ts';
import { makeSketch, makeFeature } from '@/cad/state/projectActions.ts';
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
  createNewProject,
  compareBuildOrder,
} from '@/cad/types';

/**
 * UI-facing facade over the two stores that hold CAD state:
 *   - projectStore: the durable project + undo/redo history, mutated via dispatch
 *   - viewportStore: ephemeral UI state (tabs, active operation, selection, …)
 *
 * It exposes named helpers (kept for call-site readability) that translate to
 * store dispatches/actions plus the memoized selectors the UI needs.
 */
export function useCADState() {
  const project = useProjectStore((s) => s.project);
  const dispatch = useProjectStore((s) => s.dispatch);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.canUndo);
  const canRedo = useProjectStore((s) => s.canRedo);

  // Ephemeral UI state (viewportStore). See ViewportState for the rationale.
  const activeTab = useViewportStore((s) => s.activeTab);
  const activeOperation = useViewportStore((s) => s.activeOperation);
  const selectedTreeItem = useViewportStore((s) => s.selectedTreeItem);
  const setSelectedTreeItem = useViewportStore((s) => s.setSelectedTreeItem);
  const isSidebarOpen = useViewportStore((s) => s.isSidebarOpen);
  const activeSketchId = useViewportStore((s) => s.activeSketchId);
  const setActiveSketchId = useViewportStore((s) => s.setActiveSketchId);
  const setActiveTab = useViewportStore((s) => s.setActiveTab);
  const setActiveOperation = useViewportStore((s) => s.setActiveOperation);
  const selectOperation = useViewportStore((s) => s.selectOperation);
  const switchTab = useViewportStore((s) => s.switchTab);
  const toggleSidebar = useViewportStore((s) => s.toggleSidebar);
  const setItemError = useViewportStore((s) => s.setItemError);
  const clearAllItemErrors = useViewportStore((s) => s.clearAllItemErrors);
  const itemErrors = useViewportStore((s) => s.itemErrors);

  // --- Derived selectors ---------------------------------------------------
  const featureTree = useMemo(() => buildFeatureTree(project, itemErrors), [project, itemErrors]);
  const rollbackBarIndex = useMemo(() => rollbackBarIndexOf(project), [project]);

  // --- Tree ----------------------------------------------------------------
  const toggleSelectedTreeItem = useViewportStore((s) => s.toggleSelectedTreeItem);
  const selectTreeItem = useCallback((id: string | null) => {
    toggleSelectedTreeItem(id);
  }, [toggleSelectedTreeItem]);

  const toggleTreeItemExpansion = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_TREE_ITEM_EXPANSION', id });
  }, [dispatch]);

  const toggleTreeItemVisibility = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_TREE_ITEM_VISIBILITY', id });
  }, [dispatch]);

  const editTreeItem = useCallback((id: string) => {
    setSelectedTreeItem(id);
    // TODO: Add edit modal or inline editing
    console.log('Edit item:', id);
  }, [setSelectedTreeItem]);

  const deleteTreeItem = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TREE_ITEM', id });
    // Clear selection if the deleted item was selected
    if (useViewportStore.getState().selectedTreeItem === id) setSelectedTreeItem(null);
  }, [dispatch, setSelectedTreeItem]);

  // --- Rollback bar --------------------------------------------------------
  const moveRollbackBar = useCallback((newIndex: number) => {
    dispatch({ type: 'MOVE_ROLLBACK_BAR', newIndex });
  }, [dispatch]);

  // --- Sketches ------------------------------------------------------------
  const addSketch = useCallback((name: string, plane: SketchPlane) => {
    const sketch = makeSketch(name, plane);
    dispatch({ type: 'ADD_SKETCH', sketch });
    return sketch;
  }, [dispatch]);

  const updateSketchElements = useCallback((sketchId: string, elements: SketchElement[]) => {
    dispatch({ type: 'UPDATE_SKETCH_ELEMENTS', sketchId, elements });
  }, [dispatch]);

  const updateSketchState = useCallback((sketchId: string, updatedSketch: Sketch) => {
    dispatch({ type: 'UPDATE_SKETCH_STATE', sketchId, sketch: updatedSketch });
  }, [dispatch]);

  const addConstraint = useCallback((sketchId: string, constraint: PlanegcsConstraint) => {
    dispatch({ type: 'ADD_CONSTRAINT', sketchId, constraint });
  }, [dispatch]);

  const removeConstraint = useCallback((sketchId: string, constraintId: string) => {
    dispatch({ type: 'REMOVE_CONSTRAINT', sketchId, constraintId });
  }, [dispatch]);

  const updateSketchGeometry = useCallback((sketchId: string, geometry: ShapeReference) => {
    dispatch({ type: 'UPDATE_SKETCH_GEOMETRY', sketchId, geometry });
  }, [dispatch]);

  const startSketchEdit = useCallback((sketchId: string) => {
    setActiveSketchId(sketchId);
    setActiveTab(OperationCategory.SKETCH);
  }, [setActiveSketchId, setActiveTab]);

  // Exit sketch mode. Deletes the sketch if it's empty (handled in the reducer);
  // always clears the ephemeral active-sketch id.
  const stopSketchEdit = useCallback(() => {
    const currentSketchId = useViewportStore.getState().activeSketchId;
    if (currentSketchId) {
      dispatch({ type: 'STOP_SKETCH_EDIT', sketchId: currentSketchId });
    }
    setActiveSketchId(null);
  }, [dispatch, setActiveSketchId]);

  const deleteSketch = useCallback((sketchId: string) => {
    dispatch({ type: 'DELETE_SKETCH', sketchId });
  }, [dispatch]);

  // --- Features ------------------------------------------------------------
  const addFeature = useCallback((
    name: string,
    type: Feature['type'],
    parameters?: OperationParams,
    sketchId?: string,
    parentIds: string[] = []
  ) => {
    const feature = makeFeature(name, type, parameters, sketchId, parentIds);
    dispatch({ type: 'ADD_FEATURE', feature });
    return feature;
  }, [dispatch]);

  const updateFeatureParameters = useCallback((featureId: string, parameters: OperationParams) => {
    dispatch({ type: 'UPDATE_FEATURE_PARAMETERS', featureId, parameters });
  }, [dispatch]);

  const updateFeatureGeometry = useCallback((featureId: string, geometry: ShapeReference) => {
    dispatch({ type: 'UPDATE_FEATURE_GEOMETRY', featureId, geometry });
  }, [dispatch]);

  const applyRefEnrichments = useCallback((enrichments: FeatureRefEnrichment[]) => {
    dispatch({ type: 'APPLY_REF_ENRICHMENTS', enrichments });
  }, [dispatch]);

  const applySketchRefEnrichments = useCallback((enrichments: SketchRefEnrichment[]) => {
    dispatch({ type: 'APPLY_SKETCH_REF_ENRICHMENTS', enrichments });
  }, [dispatch]);

  const toggleFeatureSuppression = useCallback((featureId: string) => {
    dispatch({ type: 'TOGGLE_FEATURE_SUPPRESSION', featureId });
  }, [dispatch]);

  const toggleFeatureVisibility = useCallback((featureId: string) => {
    dispatch({ type: 'TOGGLE_FEATURE_VISIBILITY', featureId });
  }, [dispatch]);

  const deleteFeature = useCallback((featureId: string) => {
    dispatch({ type: 'DELETE_FEATURE', featureId });
  }, [dispatch]);

  const reorderFeature = useCallback((featureId: string, newIndex: number) => {
    dispatch({ type: 'REORDER_FEATURE', featureId, newIndex });
  }, [dispatch]);

  // Drop the dragged feature immediately before/after the target in build order,
  // translating to the index-based reorderFeature against the ordered list.
  const reorderFeatureRelative = useCallback((draggedId: string, targetId: string, place: 'before' | 'after') => {
    if (draggedId === targetId) return;
    const ordered = [...project.features].sort(compareBuildOrder);
    const without = ordered.filter((f) => f.id !== draggedId);
    const targetIndex = without.findIndex((f) => f.id === targetId);
    if (targetIndex === -1) return;
    const newIndex = place === 'before' ? targetIndex : targetIndex + 1;
    reorderFeature(draggedId, newIndex);
  }, [project.features, reorderFeature]);

  // --- Project-level -------------------------------------------------------
  const saveProject = useCallback(() => {
    dispatch({ type: 'TOUCH' });
  }, [dispatch]);

  const newProject = useCallback(() => {
    dispatch({ type: 'REPLACE', project: createNewProject() });
    setSelectedTreeItem(null);
    setActiveOperation(null);
  }, [dispatch, setSelectedTreeItem, setActiveOperation]);

  const exportProject = useCallback(() => {
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportName = `${project.name.replace(/\s+/g, '_')}_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
  }, [project]);

  const importProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        dispatch({ type: 'REPLACE', project: imported });
      } catch (error) {
        console.error('Failed to import project:', error);
      }
    };
    reader.readAsText(file);
  }, [dispatch]);

  return {
    // State
    project,
    activeTab,
    activeOperation,
    selectedTreeItem,
    isSidebarOpen,
    activeSketchId,
    featureTree,
    rollbackBarIndex,

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
    applySketchRefEnrichments,
    toggleFeatureSuppression,
    toggleFeatureVisibility,
    deleteFeature,
    reorderFeature,
    reorderFeatureRelative,
    moveRollbackBar,

    // Project actions
    saveProject,
    newProject,
    exportProject,
    importProject,

    // UI actions
    toggleSidebar,

    // Undo / redo (snapshot history)
    undo,
    redo,
    canUndo,
    canRedo,

    // Item error tracking
    setItemError,
    clearAllItemErrors,
  };
}
