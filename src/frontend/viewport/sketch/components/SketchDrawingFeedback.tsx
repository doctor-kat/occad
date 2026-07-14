import { Html } from '@react-three/drei';
import { Dot } from '@phosphor-icons/react';
import type { Point2D, SketchElement, SketchOperation } from '@/cad/types';
import { SketchElementRenderer3D } from '../SketchElementRenderer3D';
import { NO_RAYCAST } from '../sketchOverlayConstants';

export interface SketchDrawingFeedbackProps {
  previewElement: SketchElement | null;
  currentPoints: Point2D[];
  hoverPoint: Point2D | null;
  activeOperation: SketchOperation | null;
  snapPoint2D: Point2D | null;
  originSnap: boolean;
}

/**
 * Live feedback for an in-progress draw tool: the yellow preview shape, the
 * green dots marking already-placed points, the pointer's snapped position,
 * a snap-target ring when snapped to a constraint point, and the
 * coincident-to-origin badge shown while snapped to the origin.
 */
export function SketchDrawingFeedback({
  previewElement,
  currentPoints,
  hoverPoint,
  activeOperation,
  snapPoint2D,
  originSnap,
}: SketchDrawingFeedbackProps) {
  return (
    <>
      {/* Render preview element */}
      {previewElement && (
        <SketchElementRenderer3D element={previewElement} color="#fbbf24" opacity={0.7} lineWidth={2} />
      )}

      {/* Render current construction points */}
      {currentPoints.map((point) => (
        <mesh key={`${point.x},${point.y}`} position={[point.x, point.y, 0.1]} raycast={NO_RAYCAST}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      ))}

      {/* Render hover point indicator */}
      {hoverPoint && activeOperation && (
        <mesh position={[hoverPoint.x, hoverPoint.y, 0.1]} raycast={NO_RAYCAST}>
          <circleGeometry args={[0.8, 16]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} />
        </mesh>
      )}

      {/* Render snap point indicator (when snapped to a constraint) */}
      {snapPoint2D && activeOperation && (
        <group position={[snapPoint2D.x, snapPoint2D.y, 0.15]}>
          {/* Outer ring */}
          <mesh raycast={NO_RAYCAST}>
            <ringGeometry args={[1.5, 2, 16]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
          </mesh>
          {/* Center dot */}
          <mesh raycast={NO_RAYCAST}>
            <circleGeometry args={[0.5, 16]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>
      )}

      {/* Coincident-to-origin preview: while drawing and snapped to the origin, show
          the coincident constraint icon that WILL be added, using the hover accent
          colour as its background so it reads as a pending relation. */}
      {originSnap && activeOperation && (
        <Html
          position={[0, 0, 0.3]}
          center
          zIndexRange={[40, 20]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            data-testid="origin-coincident-preview"
            title="Coincident with origin"
            style={{
              width: 18,
              height: 18,
              transform: 'translate(12px, -12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f97316',
              border: '1.5px solid #fdba74',
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
              userSelect: 'none',
            }}
          >
            <Dot size={14} weight="bold" color="#0a0a0f" />
          </div>
        </Html>
      )}
    </>
  );
}
