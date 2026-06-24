import { OpenCascadeViewport } from './opencascade/OpenCascadeViewport';
import type { CADProject, SketchEdgeData, SketchOperation, MeshData } from '@/cad/types';
import type { OCCStatus } from '@/worker/bridge/useOpenCascade';

export interface CADViewportProps {
  project: CADProject;
  activeSketchId: string | null;
  activeOperation: SketchOperation | null;
  selectedTreeItem?: string | null;
  occStatus: OCCStatus;
  occProgress: string;
  occError: string | null;
  occMesh: MeshData | null;
  occSketchEdges?: Record<string, SketchEdgeData> | null;
  occRetry: () => void;
  onUpdateSketch: (sketchId: string, elements: any[]) => void;
  onFinishSketch: () => void;
  onCancelSketch: () => void;
  onPlaneClick?: (planeId: string) => void;
  onFaceClick?: (faceId: number) => void;
  onEdgeClick?: (edgeIndex: number) => void;
  onVertexClick?: (vertexIndex: number) => void;
  onSketchClick?: (sketchId: string) => void;
  onBackgroundClick?: () => void;
  onUpdateConstraintValue?: (constraintId: string, value: number) => void;
}

/**
 * Main CAD Viewport Wrapper
 *
 * Renders 3D OpenCascade viewport with optional sketch overlay
 */
export function CADViewport({
  project,
  activeSketchId,
  activeOperation,
  selectedTreeItem,
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
  onFaceClick,
  onEdgeClick,
  onVertexClick,
  onSketchClick,
  onBackgroundClick,
  onUpdateConstraintValue,
}: CADViewportProps) {
  // Find the active sketch
  const activeSketch = activeSketchId
    ? project.sketches.find((s) => s.id === activeSketchId)
    : null;

  // Always show 3D viewport, with sketch overlay when in sketch mode
  return (
    <OpenCascadeViewport
      project={project}
      selectedTreeItem={selectedTreeItem}
      occStatus={occStatus}
      occProgress={occProgress}
      occError={occError}
      occMesh={occMesh}
      occSketchEdges={occSketchEdges}
      occRetry={occRetry}
      activeSketch={activeSketch}
      activeOperation={activeOperation}
      onPlaneClick={onPlaneClick}
      onFaceClick={onFaceClick}
      onEdgeClick={onEdgeClick}
      onVertexClick={onVertexClick}
      onSketchClick={onSketchClick}
      onBackgroundClick={onBackgroundClick}
      onUpdateSketch={onUpdateSketch}
      onFinishSketch={onFinishSketch}
      onCancelSketch={onCancelSketch}
      onUpdateConstraintValue={onUpdateConstraintValue}
    />
  );
}
