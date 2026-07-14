import { AppShell, Box } from '@mantine/core';
import { OpenCascadeViewport } from '@/frontend/viewport/opencascade/OpenCascadeViewport';
import { useOccStore } from '@/frontend/shared/occStore';
import { SketchConstraintToolbar } from '../../operations/SketchConstraintToolbar';
import { SketchConstraintList } from '../../operations/SketchConstraintList';
import { ViewportContextMenu } from '@/frontend/viewport/contextMenu/ViewportContextMenu';
import type { SketchOperation } from '@/cad/types';
import { useCADLayoutContext } from '../CADLayoutContext';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { useProject } from '@/frontend/shared/useProjectState';
import { projectApi } from '@/frontend/shared/projectApi';

// Main Canvas Area: the 3D viewport, the sketch constraint toolbar/list overlay
// (shown while sketching), and the right-click viewport context menu.
export function CADMainCanvas() {
  const {
    activeSketch, occ, sketchEditing, sketchPlaneSelection, viewportSelection, operationPanel,
    onPlaneClick, onSketchClick,
  } = useCADLayoutContext();
  const project = useProject();
  const activeSketchId = useViewportStore((s) => s.activeSketchId);
  const activeOperation = useViewportStore((s) => s.activeOperation);
  const selectedTreeItem = useViewportStore((s) => s.selectedTreeItem);
  const toggleFeatureSuppression = projectApi.toggleFeatureSuppression;
  const occMeshFaceOwners = useOccStore((s) => s.mesh?.faceOwners);

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
        <OpenCascadeViewport
          project={project}
          activeSketchId={activeSketchId}
          activeOperation={activeOperation as SketchOperation}
          selectedTreeItem={selectedTreeItem}
          awaitingSketchPlane={sketchPlaneSelection.awaitingSketchPlane}
          onCancelSketchPlane={sketchPlaneSelection.handleCancelSketchPlane}
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
          faceOwners={occMeshFaceOwners}
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
