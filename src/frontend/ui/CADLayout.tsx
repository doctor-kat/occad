import { AppShell, useMantineTheme } from '@mantine/core';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { projectApi } from '@/frontend/shared/projectApi';
import { useProject, useActiveSketch } from '@/frontend/shared/useProjectState';
import { DEFAULT_TESSELLATION_LEVEL } from '@/cad/types';
import type { TessellationLevel } from '@/cad/types';
import { useLocalStorage } from '@/frontend/shared/useLocalStorage';
import { useCadLayoutUiStore } from './layout/cadLayoutUiStore';
import { CADLayoutProvider, type CADLayoutContextValue, type OccBridgeValue } from './layout/CADLayoutContext';

import { useHeaderHeight } from './layout/hooks/useHeaderHeight';
import { useUndoRedoShortcut } from './layout/hooks/useUndoRedoShortcut';
import { useOCCSync } from './layout/hooks/useOCCSync';
import * as occClient from '@/worker/bridge/occWorkerClient';
import { useOccStore } from '@/frontend/shared/occStore';
import { useMeasurement } from './layout/hooks/useMeasurement';
import { useSketchEditing } from './layout/hooks/useSketchEditing';
import { useSketchPlaneSelection } from './layout/hooks/useSketchPlaneSelection';
import { useViewportSelection } from './layout/hooks/useViewportSelection';
import { useProjectIO } from './layout/hooks/useProjectIO';
import { useOperationPanel } from './layout/hooks/useOperationPanel';

import { CADHeader } from './layout/components/CADHeader';
import { CADSidebar } from './layout/components/CADSidebar';
import { CADMainCanvas } from './layout/components/CADMainCanvas';

export function CADLayout() {
  const { headerRef, headerHeight } = useHeaderHeight();
  const theme = useMantineTheme();
  const activeSidebarTab = useCadLayoutUiStore((s) => s.activeSidebarTab);

  // Durable project + derived reads from projectStore; ephemeral UI from
  // viewportStore; imperative mutations from projectApi. (useCADState is gone —
  // consumers read the stores directly.)
  const project = useProject();
  const activeOperation = useViewportStore((state) => state.activeOperation);
  const selectedTreeItem = useViewportStore((state) => state.selectedTreeItem);
  const isSidebarOpen = useViewportStore((state) => state.isSidebarOpen);
  const activeSketchId = useViewportStore((state) => state.activeSketchId);
  const selectOperation = useViewportStore((state) => state.selectOperation);
  const toggleSidebar = useViewportStore((state) => state.toggleSidebar);
  const {
    selectTreeItem, addSketch, addFeature, updateSketchElements, updateSketchState,
    addConstraint, removeConstraint, startSketchEdit, stopSketchEdit,
    updateFeatureParameters, deleteFeature, editTreeItem,
    importProject, newProject, saveProject, exportProject, undo, redo,
  } = projectApi;

  // The currently-edited sketch, if any — looked up once and reused wherever the
  // active sketch's data (not just its id) is needed.
  const activeSketch = useActiveSketch();

  // Viewport interaction state (from Zustand store)
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);
  const setSelectedFaceId = useViewportStore((state) => state.setSelectedFaceId);
  const setSelectedEdgeIndex = useViewportStore((state) => state.setSelectedEdgeIndex);
  const setSelectedVertexIndex = useViewportStore((state) => state.setSelectedVertexIndex);
  const setPendingSketchOnFace = useViewportStore((state) => state.setPendingSketchOnFace);

  // Tessellation resolution for solid bodies (Draft…Ultra). Persisted per-user;
  // drives how many facets curved surfaces get. Read into every rebuild call.
  const [tessellationLevel, setTessellationLevel] = useLocalStorage<TessellationLevel>(
    'occad-tessellation-level',
    DEFAULT_TESSELLATION_LEVEL
  );

  useOCCSync({ project, tessellationLevel });

  const occStatus = useOccStore((s) => s.status);
  const occProgress = useOccStore((s) => s.progress);
  const occError = useOccStore((s) => s.error);
  const occMesh = useOccStore((s) => s.mesh);
  const occSketchEdges = useOccStore((s) => s.sketchEdges);
  const currentFeatureShapeId = useOccStore((s) => s.currentFeatureShapeId);

  const occ: OccBridgeValue = {
    occStatus,
    occProgress,
    occError,
    occMesh,
    occRetry: occClient.retry,
    occSketchEdges,
    rebuild: occClient.rebuild,
    clearMesh: occClient.clearMesh,
    extrudeSketch: occClient.extrudeSketch,
    getFaceGeometry: occClient.getFaceGeometry,
    getEdgeLoop: occClient.getEdgeLoop,
    measureShape: occClient.measureShape,
    measureBetween: occClient.measureBetween,
    currentFeatureShapeId,
    buildSketch: occClient.buildSketch,
    resolveSelectorAsync: occClient.resolveSelectorAsync,
    exportShape: occClient.exportShape,
  };

  const measurement = useMeasurement(
    activeSidebarTab,
    occ.currentFeatureShapeId,
    occ.measureShape,
    occ.measureBetween,
  );

  const sketchEditing = useSketchEditing({
    project,
    activeSketchId,
    updateSketchElements,
    updateSketchState,
    addConstraint,
    removeConstraint,
    buildSketch: occ.buildSketch,
    stopSketchEdit,
    selectOperation,
  });

  const sketchPlaneSelection = useSketchPlaneSelection({
    project,
    currentFeatureShapeId: occ.currentFeatureShapeId,
    getFaceGeometry: occ.getFaceGeometry,
    setPendingSketchOnFace,
    addSketch,
    startSketchEdit,
    buildSketch: occ.buildSketch,
    activeSketchId,
    activeOperation,
    selectedFaceId,
    selectedEdgeIndex,
    selectedVertexIndex,
    selectedTreeItem,
    selectOperation,
    handleFinishSketch: sketchEditing.handleFinishSketch,
  });

  const viewportSelection = useViewportSelection({
    project,
    activeSketchId,
    currentFeatureShapeId: occ.currentFeatureShapeId,
    getEdgeLoop: occ.getEdgeLoop,
    recordMeasurePick: measurement.recordMeasurePick,
    selectTreeItem,
    setSelectedFaceId,
    setSelectedEdgeIndex,
    setSelectedVertexIndex,
    updateSketchState,
    buildSketch: occ.buildSketch,
    deleteFeature,
  });

  const projectIO = useProjectIO({
    project,
    currentFeatureShapeId: occ.currentFeatureShapeId,
    exportShape: occ.exportShape,
    addFeature,
    selectOperation,
    importProject,
    newProject,
    saveProject,
    exportProject,
  });

  const operationPanel = useOperationPanel({
    project,
    activeOperation,
    activeSketchId,
    isSidebarOpen,
    toggleSidebar,
    selectOperation,
    startSketchEdit,
    stopSketchEdit,
    buildSketch: occ.buildSketch,
    editTreeItem,
    updateFeatureParameters,
    addFeature,
  });

  useUndoRedoShortcut(activeSketchId, undo, redo);

  const contextValue: CADLayoutContextValue = {
    theme,
    headerRef,
    headerHeight,
    activeSketch,
    viewportSelection2D: {
      selectedFaceId,
      selectedEdgeIndex,
      selectedVertexIndex,
      setSelectedFaceId,
      setSelectedEdgeIndex,
      setSelectedVertexIndex,
    },
    tessellationLevel,
    setTessellationLevel,
    occ,
    measurement,
    sketchEditing,
    sketchPlaneSelection,
    viewportSelection,
    projectIO,
    operationPanel,
    onSelectTreeItem: (id) => {
      selectTreeItem(id);
      // Clear geometry selections when selecting from tree
      setSelectedFaceId(null);
      setSelectedEdgeIndex(null);
      setSelectedVertexIndex(null);
    },
    onPlaneClick: (planeId) => {
      selectTreeItem(planeId);
      setSelectedFaceId(null);
      setSelectedEdgeIndex(null);
      setSelectedVertexIndex(null);
    },
    onSketchClick: (sketchId) => {
      selectTreeItem(sketchId);
      setSelectedFaceId(null);
      setSelectedEdgeIndex(null);
      setSelectedVertexIndex(null);
    },
  };

  return (
    <CADLayoutProvider value={contextValue}>
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
          ref={projectIO.fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={projectIO.handleFileChange}
        />

        {/* Hidden file input for CAD geometry import (STEP / IGES / OBJ) */}
        <input
          ref={projectIO.cadImportInputRef}
          type="file"
          accept=".step,.stp,.iges,.igs,.obj"
          style={{ display: 'none' }}
          onChange={projectIO.handleCadImportFileChange}
        />

        <CADHeader />
        <CADSidebar />
        <CADMainCanvas />
      </AppShell>
    </CADLayoutProvider>
  );
}
