import { useCallback } from 'react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { CADProject, Feature, MeasureSelection } from '@/cad/types';
import { SubShapeKind } from '@/cad/types';

interface UseViewportSelectionArgs {
  project: CADProject;
  activeSketchId: string | null;
  activeSidebarTab: string | null;
  currentFeatureShapeId: string | null;
  getEdgeLoop: (requestId: string, shapeId: string, edgeIndex: number) => void;
  recordMeasurePick: (pick: MeasureSelection) => void;
  selectTreeItem: (id: string | null) => void;
  setSelectedFaceId: (id: number | null) => void;
  setSelectedEdgeIndex: (id: number | null) => void;
  setSelectedVertexIndex: (id: number | null) => void;
  setActiveSidebarTab: (tab: string | null) => void;
  updateSketchState: (sketchId: string, sketch: any) => void;
  buildSketch: (sketch: any) => void;
  deleteFeature: (featureId: string) => void;
}

// Face/edge/vertex click handling from the viewport, plus loop-select and the
// context-menu feature delete confirmation.
export function useViewportSelection({
  project,
  activeSketchId,
  activeSidebarTab,
  currentFeatureShapeId,
  getEdgeLoop,
  recordMeasurePick,
  selectTreeItem,
  setSelectedFaceId,
  setSelectedEdgeIndex,
  setSelectedVertexIndex,
  setActiveSidebarTab,
  updateSketchState,
  buildSketch,
  deleteFeature,
}: UseViewportSelectionArgs) {
  const handleFaceClick = useCallback((faceId: number) => {
    selectTreeItem(null);
    setSelectedFaceId(faceId);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(null);
    if (activeSidebarTab === 'measure') {
      recordMeasurePick({ kind: SubShapeKind.Face, index: faceId });
      return;
    }
    setActiveSidebarTab('entities');
  }, [activeSidebarTab, recordMeasurePick, selectTreeItem, setSelectedFaceId, setSelectedEdgeIndex, setSelectedVertexIndex, setActiveSidebarTab]);

  const handleEdgeClick = useCallback((edgeIndex: number) => {
    if (activeSketchId) {
      const sketch = project.sketches.find(s => s.id === activeSketchId);
      if (sketch) {
        const sourceId = `edge-${edgeIndex}`;
        if (!sketch.primitives.some((p: any) => p.sourceId === sourceId)) {
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

    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(edgeIndex);
    setSelectedVertexIndex(null);
    if (activeSidebarTab === 'measure') {
      recordMeasurePick({ kind: SubShapeKind.Edge, index: edgeIndex });
      return;
    }
    setActiveSidebarTab('entities');
  }, [activeSketchId, project.sketches, updateSketchState, buildSketch, activeSidebarTab, recordMeasurePick, selectTreeItem, setSelectedFaceId, setSelectedEdgeIndex, setSelectedVertexIndex, setActiveSidebarTab]);

  const handleVertexClick = useCallback((vertexIndex: number) => {
    if (activeSketchId) {
      const sketch = project.sketches.find(s => s.id === activeSketchId);
      if (sketch) {
        const sourceId = `vertex-${vertexIndex}`;
        if (!sketch.primitives.some((p: any) => p.sourceId === sourceId)) {
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

    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(vertexIndex);
    if (activeSidebarTab === 'measure') {
      recordMeasurePick({ kind: SubShapeKind.Vertex, index: vertexIndex });
    }
  }, [activeSketchId, project.sketches, updateSketchState, buildSketch, activeSidebarTab, recordMeasurePick, selectTreeItem, setSelectedFaceId, setSelectedEdgeIndex, setSelectedVertexIndex]);

  const handleBackgroundClick = useCallback(() => {
    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(null);
  }, [selectTreeItem, setSelectedFaceId, setSelectedEdgeIndex, setSelectedVertexIndex]);

  // "Select Loop": ask the worker for the bounding wire containing the picked
  // edge; the onEdgeLoop callback lights up the returned edges.
  const handleSelectLoop = useCallback((edgeIndex: number) => {
    if (!currentFeatureShapeId) return;
    getEdgeLoop(`loop-${Date.now()}`, currentFeatureShapeId, edgeIndex);
  }, [currentFeatureShapeId, getEdgeLoop]);

  // Delete a feature from the viewport context menu, with a confirmation step
  // (the feature-tree delete is a deliberate click on a specific row; a
  // right-click → Delete is easier to fire by accident, so guard it).
  const handleContextDeleteFeature = useCallback((featureId: string) => {
    const feature = project.features.find((f: Feature) => f.id === featureId);
    if (!feature) return;
    modals.openConfirmModal({
      title: 'Delete Feature',
      children: `Delete "${feature.name}"? This cannot be undone except via Undo.`,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteFeature(featureId);
        notifications.show({ color: 'blue', message: `Deleted ${feature.name}` });
      },
    });
  }, [project.features, deleteFeature]);

  return {
    handleFaceClick,
    handleEdgeClick,
    handleVertexClick,
    handleBackgroundClick,
    handleSelectLoop,
    handleContextDeleteFeature,
  };
}
