import { useEffect, useMemo, useRef } from "react";
import { Environment, OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { CAMERA_MOUSE_BUTTONS, middleButtonAction } from "./cameraMouseButtons";
import type { MeshData, CADProject, Sketch, SketchEdgeData, SketchOperation, ConstraintInput } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import { OCCModel } from "./OCCModel";
import { ReferencePlanes } from "./ReferencePlanes";
import { buildReferenceVisibilityMap } from "./referencePlaneGeometry";
import { OriginPoint } from "./OriginPoint";
import { SketchWireframes } from "./SketchWireframes";
import { ExtrudeArrows } from "./ExtrudeArrows";
import { SketchOverlay } from "../sketch/SketchOverlay";
import { SketchCameraOrient } from "../sketch/SketchCameraOrient";
import { CameraController } from "../contextMenu/CameraController";

export interface SceneProps {
  mesh: MeshData | null;
  project?: CADProject;
  sketchEdges?: Record<string, SketchEdgeData> | null;
  selectedPlaneId: string | null;
  selectedFaceId?: number | null;
  selectedEdgeIndex?: number | null;
  selectedVertexIndex?: number | null;
  /** Reveal all reference planes (awaiting a sketch-plane pick) */
  showAllPlanes?: boolean;
  activeSketch?: Sketch | null;
  activeOperation?: SketchOperation | null;
  activeConstraint?: string;
  onPlaneClick?: (planeId: string) => void;
  onFaceClick?: (faceId: number) => void;
  onEdgeClick?: (edgeIndex: number) => void;
  onVertexClick?: (vertexIndex: number) => void;
  onSketchClick?: (sketchId: string) => void;
  onBackgroundClick?: () => void;
  onUpdateSketch?: (sketchId: string, elements: any[]) => void;
  /** Exit sketch editing (Esc in the overlay). */
  onExitSketch?: () => void;
  /** Called when the Dimension tool completes a 2-point pick. */
  onCreateConstraint?: (input: ConstraintInput) => void;
}

export function Scene({
  mesh,
  project,
  sketchEdges,
  selectedPlaneId,
  selectedFaceId,
  selectedEdgeIndex,
  selectedVertexIndex,
  showAllPlanes,
  activeSketch,
  activeOperation,
  activeConstraint,
  onPlaneClick,
  onFaceClick,
  onEdgeClick,
  onVertexClick,
  onSketchClick,
  onBackgroundClick,
  onUpdateSketch,
  onExitSketch,
  onCreateConstraint
}: SceneProps) {
  const hoveredTreeItem = useViewportStore((state) => state.hoveredTreeItem);
  const setHoveredTreeItem = useViewportStore((state) => state.setHoveredTreeItem);
  const hoveredPlaneId = hoveredTreeItem;
  const inSketchMode = !!activeSketch;

  // Camera lives on the middle button (SolidWorks-style). Modifiers swap the
  // middle button's action on the live OrbitControls instance: Ctrl → pan,
  // Shift → zoom, otherwise orbit.
  const controlsRef = useRef<any>(null);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const controls = controlsRef.current;
      if (controls) controls.mouseButtons.MIDDLE = middleButtonAction(e.ctrlKey, e.shiftKey);
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, []);

  // Build visibility map from project reference geometry
  const visibilityMap = useMemo(
    () => buildReferenceVisibilityMap(project?.referenceGeometry),
    [project?.referenceGeometry]
  );

  // Show origin based on visibility
  const showOrigin = visibilityMap['origin'] === true;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[80, 120, 80]} intensity={1.2} castShadow />
      <directionalLight position={[-60, 80, -40]} intensity={0.6} />
      <Environment preset="studio" />

      {/* Empty-space clicks (clearing selection) are handled by the Canvas-level
          onPointerMissed in OpenCascadeViewport — a physical catcher plane would
          sit in front of sketch wireframes along some rays and steal their clicks. */}

      {/* Reference Planes - hidden in sketch mode */}
      {!inSketchMode && (
        <ReferencePlanes
          selectedPlaneId={selectedPlaneId}
          hoveredPlaneId={hoveredPlaneId}
          visibilityMap={visibilityMap}
          showAllPlanes={showAllPlanes}
          onPlaneClick={onPlaneClick}
          onPlaneHover={setHoveredTreeItem}
        />
      )}

      {/* Origin Point - dimmed in sketch mode */}
      <OriginPoint visible={showOrigin} selectedPlaneId={selectedPlaneId} dimmed={inSketchMode} />

      {/* Model (only render if mesh data exists and at least one feature is visible) */}
      {mesh && (!project || project.features.some((f) => f.isVisible)) && (
        <OCCModel
          mesh={mesh}
          selectedFaceId={selectedFaceId}
          selectedEdgeIndex={selectedEdgeIndex}
          selectedVertexIndex={selectedVertexIndex}
          inSketchMode={inSketchMode}
          onFaceClick={onFaceClick}
          onEdgeClick={onEdgeClick}
          onVertexClick={onVertexClick}
        />
      )}

      {/* Sketch wireframes (visible sketches, not in sketch mode) */}
      {!inSketchMode && project && sketchEdges && (
        <SketchWireframes
          project={project}
          sketchEdges={sketchEdges}
          selectedSketchId={selectedPlaneId}
          onSketchClick={onSketchClick}
        />
      )}

      {/* Sketch overlay (when in sketch mode) */}
      {activeSketch && onUpdateSketch && (
        <SketchOverlay
          sketch={activeSketch}
          activeOperation={activeOperation}
          activeConstraint={activeConstraint}
          onElementsChange={onUpdateSketch}
          onBackgroundClick={onBackgroundClick}
          onExitSketch={onExitSketch}
          onCreateConstraint={onCreateConstraint}
          occMesh={mesh}
          occSketchEdges={sketchEdges}
        />
      )}

      {/* Extrude Preview Arrows */}
      {project && <ExtrudeArrows project={project} />}


      {/* Camera controls — middle button only (LEFT freed for selection,
          RIGHT for the future context menu). */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        mouseButtons={CAMERA_MOUSE_BUTTONS}
      />

      {/* Applies Zoom-to-Fit / standard-view requests from the context menu */}
      <CameraController mesh={mesh} controlsRef={controlsRef} />

      {/* Swing the view normal to the sketch plane when entering a sketch */}
      <SketchCameraOrient activeSketch={activeSketch} />

      {/* View gizmo (top-right) */}
      <GizmoHelper alignment="top-right" margin={[72, 72]}>
        <GizmoViewport
          axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
          labelColor="white"
        />
      </GizmoHelper>
    </>
  );
}
