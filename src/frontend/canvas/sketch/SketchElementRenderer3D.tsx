import * as THREE from 'three';
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
  lineWidth?: number;
  isHovered?: boolean;
  isSelected?: boolean;
}) {
  // Determine color and width based on state
  let finalColor = color;
  let finalLineWidth = lineWidth;

  if (isSelected) {
    finalColor = '#fbbf24'; // Yellow/gold for selection
    finalLineWidth = lineWidth + 1;
  } else if (isHovered) {
    finalColor = '#60a5fa'; // Blue for hover
    finalLineWidth = lineWidth + 1;
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

    // TODO: Implement ellipse, spline, bezier rendering
  }

  if (points.length === 0) return null;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line geometry={geometry} position={[0, 0, 0.05]}>
      <lineBasicMaterial color={finalColor} opacity={opacity} transparent linewidth={finalLineWidth} />
    </line>
  );
}
