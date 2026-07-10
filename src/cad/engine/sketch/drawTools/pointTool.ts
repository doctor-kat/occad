import { SketchElementType } from '@/cad/types';
import type { DrawToolHandler } from './types';

/** A point is placed on a single click — never enters an in-progress state. */
export const pointTool: DrawToolHandler = {
  onClick: ({ snappedPoint }) => ({
    kind: 'complete',
    elements: [{
      type: SketchElementType.POINT,
      id: crypto.randomUUID(),
      x: snappedPoint.x,
      y: snappedPoint.y,
    }],
  }),
  onPreview: () => null,
};
