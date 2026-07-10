import { useState } from 'react';
import { AppShell, useMantineTheme } from '@mantine/core';
import { useCADState } from '@/frontend/shared/useCADState';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { DEFAULT_TESSELLATION_LEVEL, OperationCategory } from '@/cad/types';
import type { TessellationLevel } from '@/cad/types';
import { useLocalStorage } from '@/frontend/shared/useLocalStorage';

import { useHeaderHeight } from './layout/hooks/useHeaderHeight';
import { useUndoRedoShortcut } from './layout/hooks/useUndoRedoShortcut';
import { useOpenCascadeBridge } from './layout/hooks/useOpenCascadeBridge';
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
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>(OperationCategory.FEATURES);

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
    toggleFeatureSuppression,
    deleteFeature,
    reorderFeatureRelative,
    rollbackBarIndex,
    moveRollbackBar,
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
    editTreeItem,
  } = useCADState();

  // The currently-edited sketch, if any — looked up once and reused wherever the
  // active sketch's data (not just its id) is needed.
  const activeSketch = activeSketchId ? project.sketches.find((s) => s.id === activeSketchId) : undefined;

  // Viewport interaction state (from Zustand store)
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);
  const setSelectedFaceId = useViewportStore((state) => state.setSelectedFaceId);
  const setSelectedEdgeIndex = useViewportStore((state) => state.setSelectedEdgeIndex);
  const setSelectedVertexIndex = useViewportStore((state) => state.setSelectedVertexIndex);

  // Tessellation resolution for solid bodies (Draft…Ultra). Persisted per-user;
  // drives how many facets curved surfaces get. Read into every rebuild call.
  const [tessellationLevel, setTessellationLevel] = useLocalStorage<TessellationLevel>(
    'occad-tessellation-level',
    DEFAULT_TESSELLATION_LEVEL
  );

  const {
    occStatus,
    occProgress,
    occError,
    occMesh,
    occRetry,
    occSketchEdges,
    getFaceGeometry,
    getEdgeLoop,
    measureShape,
    measureBetween,
    currentFeatureShapeId,
    buildSketch,
    resolveSelectorAsync,
    exportShape,
    setMeasuredHandlers,
  } = useOpenCascadeBridge({
    project,
    tessellationLevel,
    addSketch,
    startSketchEdit,
    selectTreeItem,
    updateSketchState,
    applyRefEnrichments,
    applySketchRefEnrichments,
    setItemError,
    clearAllItemErrors,
  });

  const { measurement, measurePicks, betweenMeasurement, setMeasurePicks, setBetweenMeasurement, recordMeasurePick } =
    useMeasurement(activeSidebarTab, currentFeatureShapeId, measureShape, measureBetween, setMeasuredHandlers);

  const {
    handleUpdateSketch,
    handleSelectMidpoint,
    handleRemoveSketchElement,
    handleFinishSketch,
    handleCancelSketch,
    handleApplyConstraint,
    handleRemoveConstraint,
    handleUpdateConstraintValue,
    handleUpdateLabelOffset,
    handleToggleArrowFlip,
  } = useSketchEditing({
    project,
    activeSketchId,
    setActiveSidebarTab,
    updateSketchElements,
    updateSketchState,
    addConstraint,
    removeConstraint,
    buildSketch,
    stopSketchEdit,
    selectOperation,
  });

  const {
    awaitingSketchPlane,
    handleCancelSketchPlane,
    handleSketchButtonClick,
  } = useSketchPlaneSelection({
    project,
    currentFeatureShapeId,
    getFaceGeometry,
    setPendingSketchOnFace: useViewportStore((state) => state.setPendingSketchOnFace),
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
  });

  const {
    handleFaceClick,
    handleEdgeClick,
    handleVertexClick,
    handleBackgroundClick,
    handleSelectLoop,
    handleContextDeleteFeature,
  } = useViewportSelection({
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
  });

  const {
    fileInputRef,
    cadImportInputRef,
    handleOpen,
    handleFileChange,
    handleOperationSelect,
    handleCadImportFileChange,
    handleNew,
    handleSave,
    handleExport,
  } = useProjectIO({
    project,
    currentFeatureShapeId,
    exportShape,
    addFeature,
    selectOperation,
    importProject,
    newProject,
    saveProject,
    exportProject,
  });

  const {
    operationPanelOpen,
    editingFeatureId,
    handleOperationConfirm,
    handleOperationCancel,
    handleEditTreeItem,
  } = useOperationPanel({
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
  });

  useUndoRedoShortcut(activeSketchId, undo, redo);

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

      <CADHeader
        headerRef={headerRef}
        theme={theme}
        projectName={project.name}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onExport={handleExport}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        tessellationLevel={tessellationLevel}
        onTessellationLevelChange={setTessellationLevel}
        activeTab={activeTab}
        activeOperation={activeOperation}
        selectedTreeItem={selectedTreeItem}
        activeSketchId={activeSketchId}
        onTabChange={switchTab}
        onOperationSelect={handleOperationSelect}
        onSketchButtonClick={handleSketchButtonClick}
      />

      <CADSidebar
        theme={theme}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        project={project}
        operationPanelOpen={operationPanelOpen}
        activeOperation={activeOperation}
        editingFeatureId={editingFeatureId}
        selectedTreeItem={selectedTreeItem}
        onResolveSelector={resolveSelectorAsync}
        onOperationConfirm={handleOperationConfirm}
        onOperationCancel={handleOperationCancel}
        activeSidebarTab={activeSidebarTab}
        setActiveSidebarTab={setActiveSidebarTab}
        featureTree={featureTree}
        onSelectTreeItem={(id) => {
          selectTreeItem(id);
          // Clear geometry selections when selecting from tree
          setSelectedFaceId(null);
          setSelectedEdgeIndex(null);
          setSelectedVertexIndex(null);
        }}
        onToggleTreeItemExpansion={toggleTreeItemExpansion}
        onToggleTreeItemVisibility={toggleTreeItemVisibility}
        onEditTreeItem={handleEditTreeItem}
        onDeleteTreeItem={deleteTreeItem}
        onReorderFeature={reorderFeatureRelative}
        rollbackBarIndex={rollbackBarIndex}
        onMoveRollbackBar={moveRollbackBar}
        activeSketchId={activeSketchId}
        activeSketch={activeSketch}
        onRemoveSketchElement={handleRemoveSketchElement}
        occMesh={occMesh}
        onFaceClick={handleFaceClick}
        onEdgeClick={handleEdgeClick}
        measurement={measurement}
        currentFeatureShapeId={currentFeatureShapeId}
        measurePicks={measurePicks}
        betweenMeasurement={betweenMeasurement}
        onClearMeasurePicks={() => { setMeasurePicks([]); setBetweenMeasurement(null); }}
      />

      <CADMainCanvas
        project={project}
        activeSketchId={activeSketchId}
        activeSketch={activeSketch}
        activeOperation={activeOperation}
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
        onEditTreeItem={handleEditTreeItem}
        onSelectLoop={handleSelectLoop}
        onSelectMidpoint={handleSelectMidpoint}
        onToggleSuppressFeature={toggleFeatureSuppression}
        onDeleteFeature={handleContextDeleteFeature}
        onRemoveConstraint={handleRemoveConstraint}
      />
    </AppShell>
  );
}
