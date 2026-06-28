import * as THREE from 'three';
import { SketchElement, SketchElementType } from '@/cad/types';
import { NativePolyline } from './NativePolyline';

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

    case SketchElementType.ARC: {
      // Center-based arc (centerpoint / tangent / solved): sample the CCW sweep.
      if (
        element.center &&
        typeof element.radius === 'number' &&
        typeof element.startAngle === 'number' &&
        typeof element.endAngle === 'number'
      ) {
        const segments = 64;
        const { startAngle, endAngle, radius, center } = element;
        for (let i = 0; i <= segments; i++) {
          const a = startAngle + (endAngle - startAngle) * (i / segments);
          points.push(
            new THREE.Vector3(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius, 0)
          );
        }
      } else if (element.points && element.points.length === 3) {
        // Legacy 3-point arc (no solved geometry): draw the control polyline.
        element.points.forEach((p) => {
          points.push(new THREE.Vector3(p.x, p.y, 0));
        });
      }
      break;
    }

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

    // TODO: Implement bezier rendering
  }

  if (points.length === 0) return null;

  // Construction geometry (centerlines) renders dashed to read as reference-only.
  const isConstruction =
    element.type === SketchElementType.LINE && Boolean(element.construction);

  // `finalLineWidth` is retained above for intent, but native GL lines are width-1
  // on most platforms; hover/selection are conveyed by `finalColor` instead.
  void finalLineWidth;

  return (
    <NativePolyline
      points={points}
      color={finalColor}
      opacity={opacity}
      dashed={isConstruction}
      position={[0, 0, 0.05]}
    />
  );
}
