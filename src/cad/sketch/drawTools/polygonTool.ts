import type { DrawToolHandler } from './types';

/** N-click polygon: every click adds a vertex; completion happens separately
 *  (Enter key, handled by `handleCompletePolygon` in SketchOverlay), not here. */
export const polygonTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => ({ kind: 'continue', points: [...points, snappedPoint] }),
  onPreview: () => null,
};
