import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import { circleFromThreePoints } from '@/cad/engine/sketch/arcGeometry';
import type { DrawToolHandler } from './types';

/** Two-click circle: center, then a point on the circumference sets the radius. */
export const circleTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length === 0) return { kind: 'continue', points: [snappedPoint] };
    const center = points[0];
    const radius = Math.hypot(snappedPoint.x - center.x, snappedPoint.y - center.y);
    return {
      kind: 'complete',
      elements: [{ type: SketchElementType.CIRCLE, id: crypto.randomUUID(), center, radius }],
    };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length !== 1) return null;
    const center = points[0];
    const radius = Math.hypot(snappedPoint.x - center.x, snappedPoint.y - center.y);
    return { type: SketchElementType.CIRCLE, id: 'preview', center, radius } as SketchElement;
  },
};

/** Three points on the circumference define the circle. */
export const perimeterCircleTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length < 2) return { kind: 'continue', points: [...points, snappedPoint] };
    const circle = circleFromThreePoints(points[0], points[1], snappedPoint);
    if (!circle) return { kind: 'complete', elements: [] };
    return {
      kind: 'complete',
      elements: [{
        type: SketchElementType.CIRCLE,
        id: crypto.randomUUID(),
        center: circle.center,
        radius: circle.radius,
      }],
    };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length === 1) {
      return { type: SketchElementType.LINE, id: 'preview', start: points[0], end: snappedPoint } as SketchElement;
    }
    if (points.length === 2) {
      const circle = circleFromThreePoints(points[0], points[1], snappedPoint);
      if (!circle) return null;
      return { type: SketchElementType.CIRCLE, id: 'preview', center: circle.center, radius: circle.radius } as SketchElement;
    }
    return null;
  },
};
