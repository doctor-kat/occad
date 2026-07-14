import type { Point2D, Sketch } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import { SketchElementRenderer3D } from '../SketchElementRenderer3D';
import { NO_RAYCAST } from '../sketchOverlayConstants';

export interface SketchConstraintSnapHighlightsProps {
  activeConstraint: string;
  sketch: Sketch;
  snapPoints: Point2D[];
  edgeMidpoints: Point2D[];
  circleCenters: Point2D[];
}

/**
 * Renders the candidate snap targets for the currently-active constraint
 * picker (point/midpoint/center/edge) so the user can see what's snappable
 * before clicking.
 */
export function SketchConstraintSnapHighlights({
  activeConstraint,
  sketch,
  snapPoints,
  edgeMidpoints,
  circleCenters,
}: SketchConstraintSnapHighlightsProps) {
  return (
    <>
      {activeConstraint === 'point' && snapPoints.map((point) => (
        <mesh key={`snap-${point.x},${point.y}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <circleGeometry args={[0.6, 8]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
        </mesh>
      ))}

      {activeConstraint === 'midpoint' && edgeMidpoints.map((point) => (
        <mesh key={`midpoint-${point.x},${point.y}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <boxGeometry args={[1.2, 1.2, 0.1]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} />
        </mesh>
      ))}

      {activeConstraint === 'center' && circleCenters.map((point) => (
        <mesh key={`center-${point.x},${point.y}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <ringGeometry args={[0.8, 1.2, 16]} />
          <meshBasicMaterial color="#ec4899" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Highlight edges when edge constraint is active */}
      {activeConstraint === 'edge' && sketch.elements.map((element) => {
        if (element.type === SketchElementType.LINE || element.type === SketchElementType.RECTANGLE) {
          return (
            <SketchElementRenderer3D
              key={`edge-highlight-${element.id}`}
              element={element}
              color="#f97316"
              opacity={0.5}
              lineWidth={3}
            />
          );
        }
        return null;
      })}
    </>
  );
}
