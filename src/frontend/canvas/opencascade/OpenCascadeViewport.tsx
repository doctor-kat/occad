import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Box } from "@mantine/core";
import type { CADProject, Sketch, SketchOperation, ConstraintInput } from "@/cad/types";
import { useOccStore } from "@/frontend/shared/occStore";
import { retry as occRetry } from "@/worker/bridge/occWorkerClient";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import { useViewportContextMenu } from "../contextMenu/useViewportContextMenu";
import { Scene } from "./Scene";
import { SelectionDisplay } from "./SelectionDisplay";
import { LoadingOverlay } from "./LoadingOverlay";
import { ErrorOverlay } from "./ErrorOverlay";
import { SketchRenderer } from "../sketch/SketchRenderer";
import { SketchModeControls } from "./SketchModeControls";
import { SketchPlanePrompt } from "./SketchPlanePrompt";
import { SketchConstraintsMenu, type ConstraintType } from "./SketchConstraintsMenu";
import { SketchSelectionBox } from "./SketchSelectionBox";
import { ViewportEmptyState } from "./ViewportEmptyState";

export interface OpenCascadeViewportProps {
  /** CAD project to render (if provided, enables parametric mode) */
  project?: CADProject;
  /** ID of the sketch currently being edited, if any — the active sketch is looked up from `project`. */
  activeSketchId?: string | null;
  /** Currently selected tree item ID */
  selectedTreeItem?: string | null;
  /** Active sketch operation */
  activeOperation?: SketchOperation | null;
  /** A sketch tool is active but no plane/face is selected yet — reveal all planes for picking */
  awaitingSketchPlane?: boolean;
  /** Cancel plane-picking sketch mode (deselect the sketch tool) */
  onCancelSketchPlane?: () => void;
  /** Callback when a plane is clicked */
  onPlaneClick?: (planeId: string) => void;
  /** Callback when a face is clicked */
  onFaceClick?: (faceId: number) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (edgeIndex: number) => void;
  /** Callback when a vertex is clicked */
  onVertexClick?: (vertexIndex: number) => void;
  /** Callback when a sketch wireframe is clicked */
  onSketchClick?: (sketchId: string) => void;
  /** Callback when background is clicked (clear selection) */
  onBackgroundClick?: () => void;
  /** Callback when sketch is updated */
  onUpdateSketch?: (sketchId: string, elements: any[]) => void;
  /** Callback when sketch editing is finished */
  onFinishSketch?: () => void;
  /** Callback when sketch editing is cancelled */
  onCancelSketch?: () => void;
  onUpdateConstraintValue?: (constraintId: string, value: number) => void;
  onCreateConstraint?: (input: ConstraintInput) => void;
  onUpdateLabelOffset?: (constraintId: string, offset: { x: number; y: number }) => void;
  onToggleArrowFlip?: (constraintId: string) => void;
}

export function OpenCascadeViewport({
  project,
  activeSketchId,
  selectedTreeItem,
  activeOperation,
  awaitingSketchPlane,
  onCancelSketchPlane,
  onPlaneClick,
  onFaceClick,
  onEdgeClick,
  onVertexClick,
  onSketchClick,
  onBackgroundClick,
  onUpdateSketch,
  onFinishSketch,
  onCancelSketch,
  onUpdateConstraintValue,
  onCreateConstraint,
  onUpdateLabelOffset,
  onToggleArrowFlip
}: OpenCascadeViewportProps) {
  // Get viewport interaction state from store
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);

  // OCC worker-output state (mesh/status/error/progress/sketchEdges) lives in occStore.
  const occStatus = useOccStore((state) => state.status);
  const occProgress = useOccStore((state) => state.progress);
  const occError = useOccStore((state) => state.error);
  const occMesh = useOccStore((state) => state.mesh);
  const occSketchEdges = useOccStore((state) => state.sketchEdges);

  const activeSketch = activeSketchId ? project?.sketches.find((s) => s.id === activeSketchId) : undefined;

  // Sketch snapping-constraint state (shared with the Scene and the menu).
  const [activeConstraint, setActiveConstraint] = useState<ConstraintType>('none');

  const handleContextMenu = useViewportContextMenu(!!activeSketch);

  const isLoading = occStatus === "loading" || occStatus === "building";
  // Show empty state if no mesh and not loading/errored
  const showEmpty = !occMesh && !isLoading && !occError;

  return (
    <Box
      pos="relative"
      h="100%"
      w="100%"
      style={{
        overflow: 'hidden',
        backgroundColor: '#0a0a0f',
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [100, 80, 100], fov: 45, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "transparent", width: '100%', height: '100%' }}
        onPointerMissed={() => {
          // Clicking empty space clears selection (replaces the old catcher plane).
          // Skip in sketch mode — the SketchOverlay manages its own clicks there.
          if (!activeSketch) onBackgroundClick?.();
        }}
      >
        <Suspense fallback={null}>
          {/* Always render the scene with planes, optionally with mesh */}
          <Scene
            mesh={occMesh}
            project={project}
            sketchEdges={occSketchEdges}
            selectedPlaneId={selectedTreeItem || null}
            selectedFaceId={selectedFaceId}
            selectedEdgeIndex={selectedEdgeIndex}
            selectedVertexIndex={selectedVertexIndex}
            showAllPlanes={awaitingSketchPlane}
            activeSketch={activeSketch as Sketch | undefined}
            activeOperation={activeOperation as SketchOperation | undefined}
            activeConstraint={activeConstraint}
            onPlaneClick={onPlaneClick}
            onFaceClick={onFaceClick}
            onEdgeClick={onEdgeClick}
            onVertexClick={onVertexClick}
            onSketchClick={onSketchClick}
            onBackgroundClick={onBackgroundClick}
            onUpdateSketch={onUpdateSketch}
            onExitSketch={onCancelSketch}
            onCreateConstraint={onCreateConstraint}
          />
          {activeSketch && (
            <SketchRenderer
              sketch={activeSketch as Sketch}
              onUpdateConstraintValue={onUpdateConstraintValue}
              onUpdateLabelOffset={onUpdateLabelOffset}
              onToggleArrowFlip={onToggleArrowFlip}
            />
          )}
        </Suspense>
      </Canvas>

      <SketchSelectionBox />

      {activeSketch && (
        <SketchModeControls
          activeSketch={activeSketch}
          onCancel={onCancelSketch}
          onFinish={onFinishSketch}
        />
      )}

      {awaitingSketchPlane && !activeSketch && (
        <SketchPlanePrompt onCancel={onCancelSketchPlane} />
      )}

      {activeSketch && (
        <SketchConstraintsMenu
          activeConstraint={activeConstraint}
          onChange={setActiveConstraint}
        />
      )}

      <SelectionDisplay
        selectedTreeItem={selectedTreeItem}
        project={project}
      />

      {/* Overlays */}
      {isLoading && <LoadingOverlay message={occProgress} />}
      {occStatus === "error" && occError && <ErrorOverlay error={occError} onRetry={occRetry} />}

      {showEmpty && <ViewportEmptyState />}

      {/* Subtle gradient overlay */}
      <Box
        pos="absolute"
        style={{
          pointerEvents: 'none',
          inset: 0,
          background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.02), transparent, rgba(168, 85, 247, 0.02))',
        }}
      />
    </Box>
  );
}
