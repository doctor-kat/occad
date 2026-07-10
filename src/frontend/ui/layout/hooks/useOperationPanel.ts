import { useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import type { CADProject, Operation, OperationParams, Sketch, Feature } from '@/cad/types';
import { FeatureOperation, SketchOperation } from '@/cad/types';
import { SKETCH_TOOL_OPERATIONS } from '../ioOperations';
import { useCadLayoutUiStore } from '../cadLayoutUiStore';

interface UseOperationPanelArgs {
  project: CADProject;
  activeOperation: Operation | null;
  activeSketchId: string | null;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  selectOperation: (operation: Operation | null) => void;
  startSketchEdit: (sketchId: string) => void;
  stopSketchEdit: () => void;
  buildSketch: (sketch: Sketch) => void;
  editTreeItem: (id: string) => void;
  updateFeatureParameters: (featureId: string, params: OperationParams) => void;
  addFeature: (name: string, type: FeatureOperation, params?: OperationParams, sketchId?: string, parentIds?: string[]) => Feature;
}

// OperationPanel open/close + create-vs-edit-feature flow.
export function useOperationPanel({
  project,
  activeOperation,
  activeSketchId,
  isSidebarOpen,
  toggleSidebar,
  selectOperation,
  startSketchEdit,
  stopSketchEdit,
  buildSketch,
  editTreeItem,
  updateFeatureParameters,
  addFeature,
}: UseOperationPanelArgs) {
  const operationPanelOpen = useCadLayoutUiStore((s) => s.operationPanelOpen);
  const setOperationPanelOpen = useCadLayoutUiStore((s) => s.setOperationPanelOpen);
  const editingFeatureId = useCadLayoutUiStore((s) => s.editingFeatureId);
  const setEditingFeatureId = useCadLayoutUiStore((s) => s.setEditingFeatureId);

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
  }, [activeOperation, isSidebarOpen, toggleSidebar, setOperationPanelOpen, setEditingFeatureId]);

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

  return {
    operationPanelOpen,
    editingFeatureId,
    handleOperationConfirm,
    handleOperationCancel,
    handleEditTreeItem,
  };
}
