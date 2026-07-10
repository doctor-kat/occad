import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import { centerpointArc, tangentArc } from '@/cad/engine/sketch/arcGeometry';
import { arcElementFrom, lastEndTangent } from '@/cad/engine/sketch/arcElementFactory';
import type { DrawToolHandler } from './types';

/** Three-point arc: start, end, then a point on the arc sets its bulge. */
export const arcTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length < 2) return { kind: 'continue', points: [...points, snappedPoint] };
    return {
      kind: 'complete',
      elements: [{
        type: SketchElementType.ARC,
        id: crypto.randomUUID(),
        points: [points[0], points[1], snappedPoint],
      }],
    };
  },
  onPreview: () => null,
};

/** Centerpoint arc: center, then start (sets radius), then end (sets sweep). */
export const centerpointArcTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length < 2) return { kind: 'continue', points: [...points, snappedPoint] };
    const g = centerpointArc(points[0], points[1], snappedPoint);
    return { kind: 'complete', elements: g ? [arcElementFrom(g)] : [] };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length === 1) {
      return { type: SketchElementType.LINE, id: 'preview', start: points[0], end: snappedPoint } as SketchElement;
    }
    if (points.length === 2) {
      const g = centerpointArc(points[0], points[1], snappedPoint);
      return g ? ({ ...arcElementFrom(g), id: 'preview' } as SketchElement) : null;
    }
    return null;
  },
};

/** Tangent arc: start, then end — tangent to the previously drawn entity's
 *  end direction (see `lastEndTangent`). */
export const tangentArcTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint, sketchElements }) => {
    if (points.length === 0) return { kind: 'continue', points: [snappedPoint] };
    const g = tangentArc(points[0], lastEndTangent(sketchElements), snappedPoint);
    return { kind: 'complete', elements: g ? [arcElementFrom(g)] : [] };
  },
  onPreview: ({ points, snappedPoint, sketchElements }) => {
    if (points.length !== 1) return null;
    const g = tangentArc(points[0], lastEndTangent(sketchElements), snappedPoint);
    return g ? ({ ...arcElementFrom(g), id: 'preview' } as SketchElement) : null;
  },
};
