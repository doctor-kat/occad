import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import { buildMidpointLine } from '@/cad/engine/sketch/sketchShapeBuilders';
import type { DrawToolHandler } from './types';

/** Two-click line: first click sets the start, second sets the end.
 *  `construction` marks the Centerline variant (excluded from solid geometry). */
function makeLineTool(construction: boolean): DrawToolHandler {
  return {
    onClick: ({ points, snappedPoint }) => {
      if (points.length === 0) return { kind: 'continue', points: [snappedPoint] };
      const el: SketchElement = {
        type: SketchElementType.LINE,
        id: crypto.randomUUID(),
        start: points[0],
        end: snappedPoint,
        ...(construction ? { construction: true } : {}),
      };
      return { kind: 'complete', elements: [el] };
    },
    onPreview: ({ points, snappedPoint }) => {
      if (points.length !== 1) return null;
      return {
        type: SketchElementType.LINE,
        id: 'preview',
        start: points[0],
        end: snappedPoint,
        ...(construction ? { construction: true } : {}),
      } as SketchElement;
    },
  };
}

export const lineTool = makeLineTool(false);
export const centerlineTool = makeLineTool(true);

/** Two-click midpoint line: the two clicks define the line's midpoint and one
 *  endpoint — the actual line is built symmetric about that midpoint. */
export const midpointLineTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length === 0) return { kind: 'continue', points: [snappedPoint] };
    const { start, end } = buildMidpointLine(points[0], snappedPoint);
    return {
      kind: 'complete',
      elements: [{ type: SketchElementType.LINE, id: crypto.randomUUID(), start, end }],
    };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length !== 1) return null;
    const { start, end } = buildMidpointLine(points[0], snappedPoint);
    return { type: SketchElementType.LINE, id: 'preview', start, end } as SketchElement;
  },
};
