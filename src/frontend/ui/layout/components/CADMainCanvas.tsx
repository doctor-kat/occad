import { AppShell, Box } from '@mantine/core';
import { CADViewport } from '@/frontend/canvas/CADViewport';
import { SketchConstraintToolbar } from '../../operations/SketchConstraintToolbar';
import { SketchConstraintList } from '../../operations/SketchConstraintList';
import { ViewportContextMenu } from '@/frontend/canvas/contextMenu/ViewportContextMenu';
import type {
  CADProject, Sketch, SketchElement, Operation, SketchOperation, ConstraintInput,
  MeshData, SketchEdgeData,
} from '@/cad/types';
import type { OCCStatus } from '@/worker/bridge/useOpenCascade';

interface CADMainCanvasProps {
  project: CADProject;
  activeSketchId: string | null;
  activeSketch: Sketch | undefined;
  activeOperation: Operation | null;
  selectedTreeItem: string | null;
  awaitingSketchPlane: boolean;
  onCancelSketchPlane: () => void;
  occStatus: OCCStatus;
  occProgress: string;
  occError: string | null;
  occMesh: MeshData | null;
  occSketchEdges: Record<string, SketchEdgeData> | null;
  occRetry: () => void;
  onUpdateSketch: (sketchId: string, elements: SketchElement[]) => void;
  onFinishSketch: () => void;
  onCancelSketch: () => void;
  onPlaneClick: (planeId: string) => void;
  onSketchClick: (sketchId: string) => void;
  onFaceClick: (faceId: number) => void;
  onEdgeClick: (edgeIndex: number) => void;
  onVertexClick: (vertexIndex: number) => void;
  onBackgroundClick: () => void;
  onUpdateConstraintValue: (constraintId: string, value: number) => void;
  onCreateConstraint: (input: ConstraintInput) => void;
  onUpdateLabelOffset: (constraintId: string, offset: { x: number; y: number }) => void;
  onToggleArrowFlip: (constraintId: string) => void;
  onEditTreeItem: (id: string) => void;
  onSelectLoop: (edgeIndex: number) => void;
  onSelectMidpoint: (lineId: string) => void;
  onToggleSuppressFeature: (featureId: string) => void;
  onDeleteFeature: (featureId: string) => void;
  onRemoveConstraint: (constraintId: string) => void;
}

// Main Canvas Area: the 3D viewport, the sketch constraint toolbar/list overlay
// (shown while sketching), and the right-click viewport context menu.
export function CADMainCanvas({
  project,
  activeSketchId,
  activeSketch,
  activeOperation,
  selectedTreeItem,
  awaitingSketchPlane,
  onCancelSketchPlane,
  occStatus,
  occProgress,
  occError,
  occMesh,
  occSketchEdges,
  occRetry,
  onUpdateSketch,
  onFinishSketch,
  onCancelSketch,
  onPlaneClick,
  onSketchClick,
  onFaceClick,
  onEdgeClick,
  onVertexClick,
  onBackgroundClick,
  onUpdateConstraintValue,
  onCreateConstraint,
  onUpdateLabelOffset,
  onToggleArrowFlip,
  onEditTreeItem,
  onSelectLoop,
  onSelectMidpoint,
  onToggleSuppressFeature,
  onDeleteFeature,
  onRemoveConstraint,
}: CADMainCanvasProps) {
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
          awaitingSketchPlane={awaitingSketchPlane}
          onCancelSketchPlane={onCancelSketchPlane}
          occStatus={occStatus}
          occProgress={occProgress}
          occError={occError}
          occMesh={occMesh}
          occSketchEdges={occSketchEdges}
          occRetry={occRetry}
          onUpdateSketch={onUpdateSketch}
          onFinishSketch={onFinishSketch}
          onCancelSketch={onCancelSketch}
          onPlaneClick={onPlaneClick}
          onSketchClick={onSketchClick}
          onFaceClick={onFaceClick}
          onEdgeClick={onEdgeClick}
          onVertexClick={onVertexClick}
          onBackgroundClick={onBackgroundClick}
          onUpdateConstraintValue={onUpdateConstraintValue}
          onCreateConstraint={onCreateConstraint}
          onUpdateLabelOffset={onUpdateLabelOffset}
          onToggleArrowFlip={onToggleArrowFlip}
        />
        {activeSketchId && activeSketch && (
          <>
            <SketchConstraintToolbar sketch={activeSketch} onApply={onCreateConstraint} />
            <SketchConstraintList sketch={activeSketch} onRemove={onRemoveConstraint} />
          </>
        )}
        <ViewportContextMenu
          project={project}
          selectedTreeItem={selectedTreeItem}
          activeSketchId={activeSketchId}
          faceOwners={occMesh?.faceOwners}
          onEditItem={onEditTreeItem}
          onSelectLoop={onSelectLoop}
          onSelectMidpoint={onSelectMidpoint}
          onToggleSuppressFeature={onToggleSuppressFeature}
          onDeleteFeature={onDeleteFeature}
          onUpdateSketchElements={onUpdateSketch}
        />
      </Box>
    </AppShell.Main>
  );
}
