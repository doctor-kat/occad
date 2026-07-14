import { useCallback } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { Text as Text3D } from "@react-three/drei";
import { PLANE_SIZE, createPlaneCrosshair, createPlaneEdges, isPlaneVisible } from "./referencePlaneGeometry";

export interface ReferencePlanesProps {
  selectedPlaneId: string | null;
  hoveredPlaneId?: string | null;
  visibilityMap: Record<string, boolean>;
  /** Force all reference planes visible (e.g. while awaiting a sketch-plane pick) */
  showAllPlanes?: boolean;
  onPlaneClick?: (planeId: string) => void;
  /** Called when the pointer enters (planeId) / leaves (null) a plane in the viewport */
  onPlaneHover?: (planeId: string | null) => void;
}

// All three planes share the same size, so their outline/crosshair geometry is
// identical — built once at module scope instead of 3x per render.
const sharedPlaneEdgesGeometry = createPlaneEdges();
const sharedCrosshairGeometry = createPlaneCrosshair();

export function ReferencePlanes({ selectedPlaneId, hoveredPlaneId, visibilityMap, showAllPlanes, onPlaneClick, onPlaneHover }: ReferencePlanesProps) {
  const planeSize = PLANE_SIZE;

  const handlePlaneClick = useCallback((e: ThreeEvent<MouseEvent>, planeId: string) => {
    e.stopPropagation();
    onPlaneClick?.(planeId);
  }, [onPlaneClick]);

  const handlePlaneOver = useCallback((e: ThreeEvent<PointerEvent>, planeId: string) => {
    e.stopPropagation();
    onPlaneHover?.(planeId);
  }, [onPlaneHover]);

  const handlePlaneOut = useCallback((e: ThreeEvent<PointerEvent>, planeId: string) => {
    e.stopPropagation();
    // Only clear if we're still the hovered plane (avoids races between planes)
    if (hoveredPlaneId === planeId) onPlaneHover?.(null);
  }, [hoveredPlaneId, onPlaneHover]);

  // Get color for plane outline
  const getPlaneColor = (planeId: string) => {
    if (selectedPlaneId === planeId) return "#3b82f6"; // Blue when selected
    if (hoveredPlaneId === planeId) return "#f97316"; // Orange when hovered
    return "#888888"; // Gray default
  };

  // Crosshair is lower-contrast (dark grey) so it reads as a subtle origin guide,
  // but still picks up the selected/hovered highlight.
  const getCrosshairColor = (planeId: string) => {
    if (selectedPlaneId === planeId) return "#3b82f6"; // Blue when selected
    if (hoveredPlaneId === planeId) return "#f97316"; // Orange when hovered
    return "#2a2a2a"; // Dark grey default
  };

  // The selected/hovered plane should always draw above the other planes, whose
  // outlines and dashed crosshairs overlap along the shared axes at the origin.
  const planeOnTop = (planeId: string) =>
    selectedPlaneId === planeId || hoveredPlaneId === planeId;
  // renderOrder breaks ties among the depthTest-disabled (on-top) lines.
  const planeRenderOrder = (planeId: string) => (planeOnTop(planeId) ? 10 : 0);

  // Check if plane should be visible: toggled on, or selected/hovered from tree
  const planeVisible = (planeId: string) =>
    isPlaneVisible(planeId, { selectedPlaneId, hoveredPlaneId, visibilityMap, showAllPlanes });

  return (
    <group>
      {/* Front Plane (XY plane at Z=0) - Outline only */}
      {planeVisible('front-plane') && (
        <group>
          {/* Plane outline */}
          <lineSegments geometry={sharedPlaneEdgesGeometry} position={[0, 0, 0]} renderOrder={planeRenderOrder('front-plane')}>
            <lineBasicMaterial
              color={getPlaneColor('front-plane')}
              linewidth={2}
              toneMapped={false}
              depthTest={!planeOnTop('front-plane')}
            />
          </lineSegments>
          {/* Dashed crosshair through the origin */}
          <lineSegments geometry={sharedCrosshairGeometry} position={[0, 0, 0]} renderOrder={planeRenderOrder('front-plane')}>
            <lineDashedMaterial
              color={getCrosshairColor('front-plane')}
              dashSize={0.5}
              gapSize={0.5}
              toneMapped={false}
              depthTest={!planeOnTop('front-plane')}
            />
          </lineSegments>
          {/* Invisible clickable plane for selection */}
          <mesh
            position={[0, 0, 0]}
            onClick={(e) => handlePlaneClick(e, 'front-plane')}
            onPointerOver={(e) => handlePlaneOver(e, 'front-plane')}
            onPointerOut={(e) => handlePlaneOut(e, 'front-plane')}
          >
            <planeGeometry args={[planeSize, planeSize]} />
            <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
          </mesh>
          <Text3D
            position={[-48, 48, 0.1]}
            fontSize={3}
            color={getPlaneColor('front-plane')}
            anchorX="left"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#000000"
          >
            Front Plane
          </Text3D>
        </group>
      )}

      {/* Top Plane (XZ plane at Y=0) - Outline only */}
      {planeVisible('top-plane') && (
        <group>
          {/* Plane outline */}
          <lineSegments
            geometry={sharedPlaneEdgesGeometry}
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={planeRenderOrder('top-plane')}
          >
            <lineBasicMaterial
              color={getPlaneColor('top-plane')}
              linewidth={2}
              toneMapped={false}
              depthTest={!planeOnTop('top-plane')}
            />
          </lineSegments>
          {/* Dashed crosshair through the origin */}
          <lineSegments
            geometry={sharedCrosshairGeometry}
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={planeRenderOrder('top-plane')}
          >
            <lineDashedMaterial
              color={getCrosshairColor('top-plane')}
              dashSize={0.5}
              gapSize={0.5}
              toneMapped={false}
              depthTest={!planeOnTop('top-plane')}
            />
          </lineSegments>
          {/* Invisible clickable plane for selection */}
          <mesh
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => handlePlaneClick(e, 'top-plane')}
            onPointerOver={(e) => handlePlaneOver(e, 'top-plane')}
            onPointerOut={(e) => handlePlaneOut(e, 'top-plane')}
          >
            <planeGeometry args={[planeSize, planeSize]} />
            <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
          </mesh>
          <Text3D
            position={[-48, 0.1, -48]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={3}
            color={getPlaneColor('top-plane')}
            anchorX="left"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#000000"
          >
            Top Plane
          </Text3D>
        </group>
      )}

      {/* Right Plane (YZ plane at X=0) - Outline only */}
      {planeVisible('right-plane') && (
        <group>
          {/* Plane outline */}
          <lineSegments
            geometry={sharedPlaneEdgesGeometry}
            position={[0, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            renderOrder={planeRenderOrder('right-plane')}
          >
            <lineBasicMaterial
              color={getPlaneColor('right-plane')}
              linewidth={2}
              toneMapped={false}
              depthTest={!planeOnTop('right-plane')}
            />
          </lineSegments>
          {/* Dashed crosshair through the origin */}
          <lineSegments
            geometry={sharedCrosshairGeometry}
            position={[0, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            renderOrder={planeRenderOrder('right-plane')}
          >
            <lineDashedMaterial
              color={getCrosshairColor('right-plane')}
              dashSize={0.5}
              gapSize={0.5}
              toneMapped={false}
              depthTest={!planeOnTop('right-plane')}
            />
          </lineSegments>
          {/* Invisible clickable plane for selection */}
          <mesh
            position={[0, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            onClick={(e) => handlePlaneClick(e, 'right-plane')}
            onPointerOver={(e) => handlePlaneOver(e, 'right-plane')}
            onPointerOut={(e) => handlePlaneOut(e, 'right-plane')}
          >
            <planeGeometry args={[planeSize, planeSize]} />
            <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
          </mesh>
          <Text3D
            position={[0.1, 48, 48]}
            rotation={[0, Math.PI / 2, 0]}
            fontSize={3}
            color={getPlaneColor('right-plane')}
            anchorX="left"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#000000"
          >
            Right Plane
          </Text3D>
        </group>
      )}
    </group>
  );
}
