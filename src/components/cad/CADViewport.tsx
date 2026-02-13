import { OpenCascadeViewport } from './OpenCascadeViewport';
import { SketchCanvas } from './SketchCanvas';
import type { CADProject, SketchTool, SketchEdgeData } from '@/types/cad';
import type { OCCStatus, MeshData } from '@/hooks/useOpenCascade';

interface CADViewportProps {
  project: CADProject;
  activeSketchId: string | null;
  activeTool: SketchTool | null;
  selectedTreeItem?: string | null;
  hoveredTreeItem?: string | null;
  selectedFaceId?: number | null;
  selectedEdgeIndex?: number | null;
  selectedVertexIndex?: number | null;
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
  onBackgroundClick?: () => void;
}

/**
 * Main CAD Viewport Wrapper
 *
 * Renders 3D OpenCascade viewport with optional sketch overlay
 */
export function CADViewport({
  project,
  activeSketchId,
  activeTool,
  selectedTreeItem,
  hoveredTreeItem,
  selectedFaceId,
  selectedEdgeIndex,
  selectedVertexIndex,
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
  onBackgroundClick,
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
      hoveredTreeItem={hoveredTreeItem}
      selectedFaceId={selectedFaceId}
      selectedEdgeIndex={selectedEdgeIndex}
      selectedVertexIndex={selectedVertexIndex}
      occStatus={occStatus}
      occProgress={occProgress}
      occError={occError}
      occMesh={occMesh}
      occSketchEdges={occSketchEdges}
      occRetry={occRetry}
      activeSketch={activeSketch}
      activeTool={activeTool}
      onPlaneClick={onPlaneClick}
      onFaceClick={onFaceClick}
      onEdgeClick={onEdgeClick}
      onVertexClick={onVertexClick}
      onBackgroundClick={onBackgroundClick}
      onUpdateSketch={onUpdateSketch}
      onFinishSketch={onFinishSketch}
      onCancelSketch={onCancelSketch}
    />
  );
}
