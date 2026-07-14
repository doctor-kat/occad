import type { Point2D, SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';

/** Project a point onto a line segment; returns the projection and distance. */
export function projectPointOntoLineSegment(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D
): { projection: Point2D; distance: number } {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const distance = Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
    return { projection: lineStart, distance };
  }

  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projection: Point2D = { x: lineStart.x + t * dx, y: lineStart.y + t * dy };
  const distance = Math.sqrt(
    Math.pow(point.x - projection.x, 2) + Math.pow(point.y - projection.y, 2)
  );
  return { projection, distance };
}

/** Distance from a 2D point to a sketch element (for hover/selection). */
export function getDistanceToElement(point: Point2D, element: SketchElement): number {
  switch (element.type) {
    case SketchElementType.POINT:
      return Math.sqrt(Math.pow(point.x - element.x, 2) + Math.pow(point.y - element.y, 2));

    case SketchElementType.LINE: {
      const { distance } = projectPointOntoLineSegment(point, element.start, element.end);
      return distance;
    }

    case SketchElementType.RECTANGLE: {
      const edges: [Point2D, Point2D][] = [
        [element.corner1, { x: element.corner2.x, y: element.corner1.y }],
        [{ x: element.corner2.x, y: element.corner1.y }, element.corner2],
        [element.corner2, { x: element.corner1.x, y: element.corner2.y }],
        [{ x: element.corner1.x, y: element.corner2.y }, element.corner1],
      ];
      let minDistance = Infinity;
      edges.forEach(([start, end]) => {
        const { distance } = projectPointOntoLineSegment(point, start, end);
        minDistance = Math.min(minDistance, distance);
      });
      return minDistance;
    }

    case SketchElementType.CIRCLE: {
      const distToCenter = Math.sqrt(
        Math.pow(point.x - element.center.x, 2) + Math.pow(point.y - element.center.y, 2)
      );
      return Math.abs(distToCenter - element.radius);
    }

    case SketchElementType.POLYGON: {
      if (element.points.length < 2) return Infinity;
      let minDistance = Infinity;
      for (let i = 0; i < element.points.length; i++) {
        const start = element.points[i];
        const end = element.points[(i + 1) % element.points.length];
        const { distance } = projectPointOntoLineSegment(point, start, end);
        minDistance = Math.min(minDistance, distance);
      }
      return minDistance;
    }

    case SketchElementType.ARC: {
      // Center-based arc (centerpoint/tangent): distance to the arc's circle.
      if (element.center && typeof element.radius === 'number') {
        const distToCenter = Math.sqrt(
          Math.pow(point.x - element.center.x, 2) + Math.pow(point.y - element.center.y, 2)
        );
        return Math.abs(distToCenter - element.radius);
      }
      if (element.points && element.points.length === 3) {
        let minDistance = Infinity;
        element.points.forEach((p) => {
          const dist = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2));
          minDistance = Math.min(minDistance, dist);
        });
        return minDistance;
      }
      return Infinity;
    }

    default:
      return Infinity;
  }
}
