import type { ThreeEvent } from '@react-three/fiber';
import { SketchOperation } from '@/cad/types';
import { NO_RAYCAST } from '../sketchOverlayConstants';

export interface SketchOriginGizmoProps {
  activeOperation: SketchOperation | null;
  originSelected: boolean;
  originHoverTarget: boolean;
  onPick: (event: ThreeEvent<MouseEvent>) => void;
}

/**
 * Origin point — a fixed sketch entity at (0,0), mirroring the world Origin.
 * Selectable in selection mode (so it can be picked for a constraint); the
 * underlying fixed point primitive lives in sketch.primitives (originPoint.ts).
 */
export function SketchOriginGizmo({ activeOperation, originSelected, originHoverTarget, onPick }: SketchOriginGizmoProps) {
  const originHighlighted = originSelected || originHoverTarget;
  const isPickable = !activeOperation || activeOperation === SketchOperation.DIMENSION;

  return (
    <mesh
      position={[0, 0, 0.03]}
      renderOrder={1001}
      raycast={isPickable ? undefined : NO_RAYCAST}
      onClick={isPickable ? onPick : undefined}
    >
      <circleGeometry args={[originHighlighted ? 2 : 1.5, 24]} />
      <meshBasicMaterial
        color={originSelected ? '#3b82f6' : originHoverTarget ? '#f97316' : '#ffffff'}
        transparent
        opacity={originHighlighted ? 0.95 : 0.6}
        depthTest={false}
      />
    </mesh>
  );
}
