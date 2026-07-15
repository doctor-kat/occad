import type { Point2D } from '@/cad/types';

/**
 * Pure 2D geometry for the circle/arc sketch-tool variants. Each helper maps the
 * raw clicks a tool collects into a canonical arc description so the same math
 * drives the committed element, its live preview, the 3D renderer and the OCC
 * translation.
 *
 * Angles are radians measured CCW from the workplane +X axis. The sweep is
 * always normalized so that travelling CCW from `startAngle` to `endAngle`
 * (with `endAngle >= startAngle`) traces the intended arc — both the renderer
 * and `BRepBuilderAPI_MakeEdge` consume the arc that way.
 */

export interface ArcGeometry {
  center: Point2D;
  radius: number;
  /** CCW radians from +X at the first endpoint of the sweep. */
  startAngle: number;
  /** CCW radians at the second endpoint; always `>= startAngle`. */
  endAngle: number;
}

const EPS = 1e-9;
const TWO_PI = Math.PI * 2;

/** CCW angular distance from `a` to `b`, in [0, 2π). */
function ccwDelta(a: number, b: number): number {
  let d = (b - a) % TWO_PI;
  if (d < 0) d += TWO_PI;
  return d;
}

function normalize(v: Point2D): Point2D {
  const len = Math.hypot(v.x, v.y);
  return len < EPS ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

/**
 * Circumcircle through three points. Also the geometry behind the
 * Perimeter (3-point) Circle tool. Returns null when the points are collinear.
 */
export function circleFromThreePoints(
  a: Point2D,
  b: Point2D,
  c: Point2D
): { center: Point2D; radius: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < EPS) return null;

  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;

  const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;

  const center = { x: ux, y: uy };
  const radius = Math.hypot(a.x - ux, a.y - uy);
  return { center, radius };
}

/**
 * Centerpoint arc: `center`, then `start` (sets the radius + start angle), then
 * `end` (its angle, projected onto the radius circle). Sweeps CCW from start to
 * end. Returns null when `start` coincides with `center`.
 */
export function centerpointArc(
  center: Point2D,
  start: Point2D,
  end: Point2D
): ArcGeometry | null {
  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  if (radius < EPS) return null;

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endRaw = Math.atan2(end.y - center.y, end.x - center.x);
  const endAngle = startAngle + ccwDelta(startAngle, endRaw);
  return { center, radius, startAngle, endAngle };
}

/**
 * 3-point arc through `p1` (start), `mid` and `p3` (end). The CCW sweep is
 * anchored so it always passes through `mid`. Returns null for collinear points.
 */
export function arcFromThreePoints(
  p1: Point2D,
  mid: Point2D,
  p3: Point2D
): ArcGeometry | null {
  const circle = circleFromThreePoints(p1, mid, p3);
  if (!circle) return null;
  const { center, radius } = circle;

  const t1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const t2 = Math.atan2(mid.y - center.y, mid.x - center.x);
  const t3 = Math.atan2(p3.y - center.y, p3.x - center.x);

  const d2 = ccwDelta(t1, t2);
  const d3 = ccwDelta(t1, t3);

  if (d2 < d3) {
    // CCW from p1 reaches mid before p3 → sweep CCW p1 → p3.
    return { center, radius, startAngle: t1, endAngle: t1 + d3 };
  }
  // Otherwise the arc through mid is the CW one from p1; express it as a CCW
  // sweep from p3 to p1 (same shape, traversed the other way).
  return { center, radius, startAngle: t3, endAngle: t3 + ccwDelta(t3, t1) };
}

/**
 * Tangent arc: starts at `start` tangent to `tangentDir` and ends at `end`.
 * The center lies on the line through `start` perpendicular to the tangent; the
 * radius is fixed by requiring `end` to be on the circle. Returns null when
 * `end` lies on the tangent line (the radius would be infinite) or the tangent
 * direction is degenerate.
 */
export function tangentArc(
  start: Point2D,
  tangentDir: Point2D,
  end: Point2D
): ArcGeometry | null {
  const t = normalize(tangentDir);
  if (t.x === 0 && t.y === 0) return null;

  // Perpendicular to the tangent (90° CCW); the center sits along it.
  const nperp = { x: -t.y, y: t.x };
  const dvec = { x: start.x - end.x, y: start.y - end.y };
  const denom = dvec.x * nperp.x + dvec.y * nperp.y;
  if (Math.abs(denom) < EPS) return null;

  const s = -(dvec.x * dvec.x + dvec.y * dvec.y) / (2 * denom);
  const center = { x: start.x + s * nperp.x, y: start.y + s * nperp.y };
  const radius = Math.abs(s);
  if (radius < EPS) return null;

  const tStart = Math.atan2(start.y - center.y, start.x - center.x);
  const tEnd = Math.atan2(end.y - center.y, end.x - center.x);

  // CCW velocity at the start angle; if it points along the tangent we sweep CCW
  // from start, otherwise the tangent arc is the CCW sweep from end back to start.
  const tanCCW = { x: -Math.sin(tStart), y: Math.cos(tStart) };
  if (tanCCW.x * t.x + tanCCW.y * t.y >= 0) {
    return { center, radius, startAngle: tStart, endAngle: tStart + ccwDelta(tStart, tEnd) };
  }
  return { center, radius, startAngle: tEnd, endAngle: tEnd + ccwDelta(tEnd, tStart) };
}

/**
 * Direction of travel at the *end* of a finished element — used by the Tangent
 * Arc tool to continue tangentially from the previously drawn entity. Returns
 * null when no meaningful direction can be derived.
 */
export function endTangentDirection(
  element: { type: string } & Record<string, any>
): Point2D | null {
  switch (element.type) {
    case 'line': {
      const d = { x: element.end.x - element.start.x, y: element.end.y - element.start.y };
      return d.x === 0 && d.y === 0 ? null : normalize(d);
    }
    case 'arc': {
      if (typeof element.endAngle === 'number' && element.center) {
        // CCW tangent at the end angle (matches the arc's CCW parameterization).
        return normalize({ x: -Math.sin(element.endAngle), y: Math.cos(element.endAngle) });
      }
      if (element.points && element.points.length >= 2) {
        const a = element.points[element.points.length - 2];
        const b = element.points[element.points.length - 1];
        const d = { x: b.x - a.x, y: b.y - a.y };
        return d.x === 0 && d.y === 0 ? null : normalize(d);
      }
      return null;
    }
    default:
      return null;
  }
}
