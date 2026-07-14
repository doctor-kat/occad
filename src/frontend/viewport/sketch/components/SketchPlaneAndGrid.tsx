import type { Ref } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { NO_RAYCAST } from '../sketchOverlayConstants';

export interface SketchPlaneAndGridProps {
  planeRef: Ref<THREE.Mesh>;
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerLeave: () => void;
  showGrid: boolean;
  gridSize: number;
  xAxisGeo: THREE.BufferGeometry;
  yAxisGeo: THREE.BufferGeometry;
}

/** The sketch plane's clickable surface, its grid, and the origin axis crosshair. */
export function SketchPlaneAndGrid({
  planeRef,
  onClick,
  onPointerMove,
  onPointerLeave,
  showGrid,
  gridSize,
  xAxisGeo,
  yAxisGeo,
}: SketchPlaneAndGridProps) {
  return (
    <>
      {/* Semi-transparent sketch plane */}
      <mesh
        ref={planeRef}
        position={[0, 0, 0.01]}
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Grid on sketch plane (visibility toggled with 'H', independent of snap) */}
      {showGrid && (
        <gridHelper
          args={[200, 200 / gridSize, '#6366f1', '#444466']}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, 0.01]}
          raycast={NO_RAYCAST}
        />
      )}

      {/* Origin crosshair — red X, green Y */}
      <line geometry={xAxisGeo} position={[0, 0, 0.02]} renderOrder={1000} raycast={NO_RAYCAST}>
        <lineBasicMaterial color="#ef4444" transparent opacity={0.35} depthTest={false} />
      </line>
      <line geometry={yAxisGeo} position={[0, 0, 0.02]} renderOrder={1000} raycast={NO_RAYCAST}>
        <lineBasicMaterial color="#22c55e" transparent opacity={0.35} depthTest={false} />
      </line>
    </>
  );
}
