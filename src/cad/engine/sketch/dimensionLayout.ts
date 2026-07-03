import type { Point2D } from '@/cad/types';

/**
 * Pure 2D geometry for rendering a CAD-style dimension: two extension (witness)
 * lines running from the referenced entities out to a dimension line, arrowheads
 * at each end of the dimension line, and a label position at its midpoint.
 * No THREE/R3F dependency — consumed by SketchRenderer.tsx.
 */
export interface DimensionLayout {
  ext1: [Point2D, Point2D];
  ext2: [Point2D, Point2D];
  /** Full dimension line from arrow tip to arrow tip — kept intact (not gapped) since
   *  it anchors the arrows, the drag midpoint, and existing consumers/tests. */
  dimLine: [Point2D, Point2D];
  /** `dimLine` split into two segments around `labelPos`, so drawing them (instead of
   *  `dimLine` itself) leaves a gap for the value text instead of running through it.
   *  Collapses toward two touching segments (no visible gap) rather than inverting
   *  when the dimension is shorter than the gap. */
  dimLineSegments: [[Point2D, Point2D], [Point2D, Point2D]];
  labelPos: Point2D;
  /** 3-point chevron (wing, tip, wing) — draw as a polyline. */
  arrow1: [Point2D, Point2D, Point2D];
  arrow2: [Point2D, Point2D, Point2D];
}

/** How far an extension line overshoots past the dimension line (typical CAD look). */
const EXT_OVERSHOOT = 2;
const ARROW_LENGTH = 1.5;
const ARROW_SPREAD = Math.PI / 8; // 22.5°
/** Half-width of the gap left in the dimension line for the value label — roughly
 *  matches the label's rendered width for a short (2-3 digit) value at its font size. */
const LABEL_GAP_HALF = 3;

const sub = (a: Point2D, b: Point2D): Point2D => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point2D, b: Point2D): Point2D => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point2D, s: number): Point2D => ({ x: a.x * s, y: a.y * s });
const len = (a: Point2D): number => Math.hypot(a.x, a.y);
const normalize = (a: Point2D): Point2D => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
const perp = (a: Point2D): Point2D => ({ x: -a.y, y: a.x });
const rotate = (a: Point2D, theta: number): Point2D => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** 3-point chevron pointing "inward" (along `inward`) with its tip at `tip`. */
function arrowAt(tip: Point2D, inward: Point2D): [Point2D, Point2D, Point2D] {
  const back = scale(inward, -ARROW_LENGTH);
  return [add(tip, rotate(back, ARROW_SPREAD)), tip, add(tip, rotate(back, -ARROW_SPREAD))];
}

/** Split [d1, d2] into two segments leaving a `LABEL_GAP_HALF`-wide gap centered on
 *  the midpoint, clamped so short dimension lines shrink the gap rather than invert.
 *  Takes the already-normalized d1->d2 direction so callers that computed it don't redo the work. */
function dimLineSegments(d1: Point2D, d2: Point2D, dir: Point2D): [[Point2D, Point2D], [Point2D, Point2D]] {
  const half = Math.min(LABEL_GAP_HALF, len(sub(d2, d1)) / 2);
  const mid = scale(add(d1, d2), 0.5);
  const gapStart = sub(mid, scale(dir, half));
  const gapEnd = add(mid, scale(dir, half));
  return [[d1, gapStart], [gapEnd, d2]];
}

/** Component of `offset` perpendicular to the p1->p2 direction. */
function perpOffset(p1: Point2D, p2: Point2D, offset: Point2D): Point2D {
  const n = perp(normalize(sub(p2, p1)));
  const dist = offset.x * n.x + offset.y * n.y;
  return scale(n, dist);
}

function fromShiftedEndpoints(
  p1: Point2D, p2: Point2D, d1: Point2D, d2: Point2D, overshootDir: Point2D, flip = false,
): DimensionLayout {
  const overshoot = scale(overshootDir, EXT_OVERSHOOT);
  const dir = normalize(sub(d2, d1));
  // Both arrows flip together — this is a single "inside"/"outside" style toggle for
  // the whole dimension (the standard CAD convention for a dimension too tight for
  // both arrowheads to fit inside the witness lines), not two independent arrows.
  return {
    ext1: [p1, add(d1, overshoot)],
    ext2: [p2, add(d2, overshoot)],
    dimLine: [d1, d2],
    dimLineSegments: dimLineSegments(d1, d2, dir),
    labelPos: scale(add(d1, d2), 0.5),
    arrow1: arrowAt(d1, flip ? scale(dir, -1) : dir),
    arrow2: arrowAt(d2, flip ? dir : scale(dir, -1)),
  };
}

/** Point-to-point distance dimension: extension lines perpendicular to p1->p2. */
export function pointPointDimensionLayout(p1: Point2D, p2: Point2D, offset: Point2D, flip = false): DimensionLayout {
  const shift = perpOffset(p1, p2, offset);
  const overshootDir = len(shift) === 0 ? perp(normalize(sub(p2, p1))) : normalize(shift);
  return fromShiftedEndpoints(p1, p2, add(p1, shift), add(p2, shift), overshootDir, flip);
}

/** Foot of the perpendicular from `point` onto the infinite line through lineStart/lineEnd. */
function footOfPerpendicular(point: Point2D, lineStart: Point2D, lineEnd: Point2D): Point2D {
  const dir = normalize(sub(lineEnd, lineStart));
  const t = (point.x - lineStart.x) * dir.x + (point.y - lineStart.y) * dir.y;
  return add(lineStart, scale(dir, t));
}

/** Point-to-line perpendicular distance dimension: reduces to point-point against
 *  the foot of the perpendicular, since that segment IS the shortest distance. */
export function pointLineDimensionLayout(
  point: Point2D, lineStart: Point2D, lineEnd: Point2D, offset: Point2D, flip = false,
): DimensionLayout {
  return pointPointDimensionLayout(point, footOfPerpendicular(point, lineStart, lineEnd), offset, flip);
}

/** Axis-aligned (horizontal/vertical) dimension: extension lines run along the
 *  OTHER axis out to a dimension line parallel to `axis`. */
export function axisDimensionLayout(
  p1: Point2D, p2: Point2D, axis: 'x' | 'y', offset: Point2D, flip = false,
): DimensionLayout {
  if (axis === 'x') {
    const dimY = p1.y + offset.y;
    const d1: Point2D = { x: p1.x, y: dimY };
    const d2: Point2D = { x: p2.x, y: dimY };
    return fromShiftedEndpoints(p1, p2, d1, d2, { x: 0, y: Math.sign(offset.y) || 1 }, flip);
  }
  const dimX = p1.x + offset.x;
  const d1: Point2D = { x: dimX, y: p1.y };
  const d2: Point2D = { x: dimX, y: p2.y };
  return fromShiftedEndpoints(p1, p2, d1, d2, { x: Math.sign(offset.x) || 1, y: 0 }, flip);
}
