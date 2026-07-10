import { AppShell, Box } from '@mantine/core';
import { CADViewport } from '@/frontend/canvas/CADViewport';
import { SketchConstraintToolbar } from '../../operations/SketchConstraintToolbar';
import { SketchConstraintList } from '../../operations/SketchConstraintList';
import { ViewportContextMenu } from '@/frontend/canvas/contextMenu/ViewportContextMenu';
import type { SketchOperation } from '@/cad/types';
import { useCADLayoutContext } from '../CADLayoutContext';

// Main Canvas Area: the 3D viewport, the sketch constraint toolbar/list overlay
// (shown while sketching), and the right-click viewport context menu.
export function CADMainCanvas() {
  const {
    cadState, activeSketch, occ, sketchEditing, sketchPlaneSelection, viewportSelection, operationPanel,
    onPlaneClick, onSketchClick,
  } = useCADLayoutContext();
  const { project, activeSketchId, activeOperation, selectedTreeItem, toggleFeatureSuppression } = cadState;

  return (
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
          awaitingSketchPlane={sketchPlaneSelection.awaitingSketchPlane}
          onCancelSketchPlane={sketchPlaneSelection.handleCancelSketchPlane}
          occStatus={occ.occStatus}
          occProgress={occ.occProgress}
          occError={occ.occError}
          occMesh={occ.occMesh}
          occSketchEdges={occ.occSketchEdges}
          occRetry={occ.occRetry}
          onUpdateSketch={sketchEditing.handleUpdateSketch}
          onFinishSketch={sketchEditing.handleFinishSketch}
          onCancelSketch={sketchEditing.handleCancelSketch}
          onPlaneClick={onPlaneClick}
          onSketchClick={onSketchClick}
          onFaceClick={viewportSelection.handleFaceClick}
          onEdgeClick={viewportSelection.handleEdgeClick}
          onVertexClick={viewportSelection.handleVertexClick}
          onBackgroundClick={viewportSelection.handleBackgroundClick}
          onUpdateConstraintValue={sketchEditing.handleUpdateConstraintValue}
          onCreateConstraint={sketchEditing.handleApplyConstraint}
          onUpdateLabelOffset={sketchEditing.handleUpdateLabelOffset}
          onToggleArrowFlip={sketchEditing.handleToggleArrowFlip}
        />
        {activeSketchId && activeSketch && (
          <>
            <SketchConstraintToolbar sketch={activeSketch} onApply={sketchEditing.handleApplyConstraint} />
            <SketchConstraintList sketch={activeSketch} onRemove={sketchEditing.handleRemoveConstraint} />
          </>
        )}
        <ViewportContextMenu
          project={project}
          selectedTreeItem={selectedTreeItem}
          activeSketchId={activeSketchId}
          faceOwners={occ.occMesh?.faceOwners}
          onEditItem={operationPanel.handleEditTreeItem}
          onSelectLoop={viewportSelection.handleSelectLoop}
          onSelectMidpoint={sketchEditing.handleSelectMidpoint}
          onToggleSuppressFeature={toggleFeatureSuppression}
          onDeleteFeature={viewportSelection.handleContextDeleteFeature}
          onUpdateSketchElements={sketchEditing.handleUpdateSketch}
        />
      </Box>
    </AppShell.Main>
  );
}
