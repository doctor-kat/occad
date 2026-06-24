import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { SketchElement, SketchElementType } from '@/cad/types';

/**
 * Renders a single sketch element in 3D space
 */
export function SketchElementRenderer3D({
  element,
  color,
  opacity = 1,
  lineWidth = 2,
  isHovered = false,
  isSelected = false,
}: {
  element: SketchElement;
  color: string;
  opacity?: number;
  lineWidth?: number; // Base line width
  isHovered?: boolean;
  isSelected?: boolean;
}) {
  // Determine color and width based on state
  let finalColor = color;
  let finalLineWidth = lineWidth || 4; // Default to 4 for better visibility

  if (isSelected) {
    finalColor = '#fbbf24'; // Yellow/gold for selection
    finalLineWidth = finalLineWidth + 2; // Increase more significantly for selected
  } else if (isHovered) {
    finalColor = '#60a5fa'; // Blue for hover
    finalLineWidth = finalLineWidth + 1;
  }

  const points: THREE.Vector3[] = [];

  switch (element.type) {
    case SketchElementType.LINE:
      points.push(
        new THREE.Vector3(element.start.x, element.start.y, 0),
        new THREE.Vector3(element.end.x, element.end.y, 0)
      );
      break;

    case SketchElementType.RECTANGLE: {
      const { corner1, corner2 } = element;
      points.push(
        new THREE.Vector3(corner1.x, corner1.y, 0),
        new THREE.Vector3(corner2.x, corner1.y, 0),
        new THREE.Vector3(corner2.x, corner2.y, 0),
        new THREE.Vector3(corner1.x, corner2.y, 0),
        new THREE.Vector3(corner1.x, corner1.y, 0)
      );
      break;
    }

    case SketchElementType.CIRCLE: {
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(
          new THREE.Vector3(
            element.center.x + Math.cos(angle) * element.radius,
            element.center.y + Math.sin(angle) * element.radius,
            0
          )
        );
      }
      break;
    }

    case SketchElementType.POLYGON:
      element.points.forEach((p) => {
        points.push(new THREE.Vector3(p.x, p.y, 0));
      });
      if (element.points.length > 0) {
        const first = element.points[0];
        points.push(new THREE.Vector3(first.x, first.y, 0));
      }
      break;

    case SketchElementType.ARC:
      // TODO: Implement proper arc rendering with 3 points
      if (element.points && element.points.length === 3) {
        element.points.forEach((p) => {
          points.push(new THREE.Vector3(p.x, p.y, 0));
        });
      }
      break;

    case SketchElementType.ELLIPSE: {
      const segments = 64;
      const rotation = (element.rotation || 0) * (Math.PI / 180);
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * element.majorRadius;
        const y = Math.sin(angle) * element.minorRadius;
        // Apply rotation
        const rx = x * Math.cos(rotation) - y * Math.sin(rotation);
        const ry = x * Math.sin(rotation) + y * Math.cos(rotation);
        points.push(new THREE.Vector3(element.center.x + rx, element.center.y + ry, 0));
      }
      break;
    }

    // TODO: Implement spline, bezier rendering
  }

  if (points.length === 0) return null;

  return (
    <Line
      points={points}
      color={finalColor}
      lineWidth={finalLineWidth}
      opacity={opacity}
      transparent
      position={[0, 0, 0.05]}
      // Decoration only: hover/selection is computed by 2D distance math in
      // SketchOverlay, never by raycasting these lines. Leaving them raycastable
      // lets a thick preview/element line sit under the cursor and swallow the
      // click meant for the sketch plane (e.g. the preview rectangle's far
      // corner is always under the pointer), so the next sketch point is lost.
      raycast={NO_RAYCAST}
    />
  );
}

/** A no-op raycast so a mesh/line is visible but never an intersection target. */
const NO_RAYCAST = () => null;
