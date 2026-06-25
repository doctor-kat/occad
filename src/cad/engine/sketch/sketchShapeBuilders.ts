import type { Point2D } from '@/cad/types';

/**
 * Pure geometry for the sketch line/rectangle variants. Each helper maps the raw
 * click points a tool collects into the corner/endpoint data of a concrete sketch
 * element, so the same math drives both the committed element and its live preview.
 *
 * Rotated/skewed shapes (3-point and parallelogram rectangles) can't be expressed
 * by an axis-aligned {@link SketchRectangle} (corner1/corner2), so they're emitted
 * as 4-point polygons.
 */

const sub = (a: Point2D, b: Point2D): Point2D => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point2D, b: Point2D): Point2D => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point2D, s: number): Point2D => ({ x: a.x * s, y: a.y * s });
const dot = (a: Point2D, b: Point2D): number => a.x * b.x + a.y * b.y;
/** 90° CCW perpendicular. */
const perp = (a: Point2D): Point2D => ({ x: -a.y, y: a.x });
const normalize = (a: Point2D): Point2D => {
  const len = Math.hypot(a.x, a.y);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
};

/**
 * Midpoint line: the first click is the line's midpoint, the second is an endpoint;
 * the line extends symmetrically so the midpoint stays centered.
 */
export function buildMidpointLine(mid: Point2D, end: Point2D): { start: Point2D; end: Point2D } {
  return { start: { x: 2 * mid.x - end.x, y: 2 * mid.y - end.y }, end };
}

/**
 * Center rectangle (axis-aligned): the first click is the center, the second a corner.
 * The opposite corner is mirrored through the center.
 */
export function buildCenterRectangle(
  center: Point2D,
  corner: Point2D
): { corner1: Point2D; corner2: Point2D } {
  const dx = corner.x - center.x;
  const dy = corner.y - center.y;
  return {
    corner1: { x: center.x - dx, y: center.y - dy },
    corner2: { x: center.x + dx, y: center.y + dy },
  };
}

/**
 * 3-point corner rectangle: `a`→`b` defines the first edge (direction + length),
 * `c` sets the width as its perpendicular distance from that edge. Returns the 4
 * corners in order.
 */
export function buildThreePointCornerRectangle(a: Point2D, b: Point2D, c: Point2D): Point2D[] {
  const n = normalize(perp(sub(b, a)));
  const offset = scale(n, dot(sub(c, b), n));
  return [a, b, add(b, offset), add(a, offset)];
}

/**
 * 3-point center rectangle: `center`→`edgeMid` is the half-extent and orientation of
 * one axis (so `edgeMid` is the midpoint of an edge), `widthPt` sets the perpendicular
 * half-width. Returns the 4 corners in order.
 */
export function buildThreePointCenterRectangle(
  center: Point2D,
  edgeMid: Point2D,
  widthPt: Point2D
): Point2D[] {
  const h = sub(edgeMid, center); // half-extent along the primary axis
  const n = normalize(perp(h));
  const w = scale(n, dot(sub(widthPt, center), n)); // perpendicular half-width
  return [
    add(add(center, h), w),
    sub(add(center, h), w),
    sub(sub(center, h), w),
    add(sub(center, h), w),
  ];
}

/**
 * Parallelogram: `a`→`b` is the first edge, `c` is the corner adjacent to `b`. The
 * fourth corner closes the parallelogram (`a + (c - b)`). Returns the 4 corners in order.
 */
export function buildParallelogram(a: Point2D, b: Point2D, c: Point2D): Point2D[] {
  const d = { x: a.x + (c.x - b.x), y: a.y + (c.y - b.y) };
  return [a, b, c, d];
}
