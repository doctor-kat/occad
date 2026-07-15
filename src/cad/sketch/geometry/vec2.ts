import type { Point2D } from '@/cad/types';

/**
 * Shared 2D vector math for sketch geometry. Pulled out of dimensionLayout.ts,
 * sketchShapeBuilders.ts and constraintAnchors.ts, which each defined identical
 * one-line versions of these helpers independently.
 */

export const add = (a: Point2D, b: Point2D): Point2D => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point2D, b: Point2D): Point2D => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point2D, s: number): Point2D => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Point2D, b: Point2D): number => a.x * b.x + a.y * b.y;
export const mid = (a: Point2D, b: Point2D): Point2D => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const length = (a: Point2D): number => Math.hypot(a.x, a.y);
export const normalize = (a: Point2D): Point2D => {
  const l = length(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** 90° CCW perpendicular. */
export const perp = (a: Point2D): Point2D => ({ x: -a.y, y: a.x });
