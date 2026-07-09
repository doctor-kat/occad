import type { Point2D, SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';

/**
 * Screen-space box / crossing selection for sketch entities (SolidWorks model).
 *
 * Pure geometry: every function here works on 2D sketch-plane points plus a
 * caller-supplied `project` that maps a plane point to screen-space CSS px. That
 * keeps the math independent of THREE/WebGL so it can be unit-tested with a stub
 * projection (see sketchBoxSelection.test.ts) while the live overlay feeds it the
 * real camera projection.
 */

export enum BoxMode {
  Window = 'window',
  Crossing = 'crossing',
}

export type { ScreenRect } from './ScreenRect';
export type { ScreenPoint } from './ScreenPoint';
import type { ScreenRect } from './ScreenRect';
import type { ScreenPoint } from './ScreenPoint';

/**
 * Drag direction decides the mode (SolidWorks): dragging to the right
 * (end ≥ start) is a **window** select — only fully enclosed entities; dragging
 * to the left is a **crossing** select — anything the box touches.
 */
export function boxMode(startX: number, endX: number): BoxMode {
  return endX >= startX ? BoxMode.Window : BoxMode.Crossing;
}

/** Build a normalised rectangle from two opposite corners. */
export function rectFromCorners(x0: number, y0: number, x1: number, y1: number): ScreenRect {
  return {
    minX: Math.min(x0, x1),
    minY: Math.min(y0, y1),
    maxX: Math.max(x0, x1),
    maxY: Math.max(y0, y1),
  };
}

function pointInRect(p: ScreenPoint, r: ScreenRect): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

/** Orientation sign of the ordered triple (a, b, c). */
function cross(a: ScreenPoint, b: ScreenPoint, c: ScreenPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** True if segment p1p2 and segment p3p4 intersect (proper or touching). */
function segmentsIntersect(p1: ScreenPoint, p2: ScreenPoint, p3: ScreenPoint, p4: ScreenPoint): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // Collinear-on-segment touches.
  const onSeg = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) =>
    Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y);
  if (d1 === 0 && onSeg(p3, p4, p1)) return true;
  if (d2 === 0 && onSeg(p3, p4, p2)) return true;
  if (d3 === 0 && onSeg(p1, p2, p3)) return true;
  if (d4 === 0 && onSeg(p1, p2, p4)) return true;
  return false;
}

/** True if segment a→b touches or enters the rectangle. */
function segmentIntersectsRect(a: ScreenPoint, b: ScreenPoint, r: ScreenRect): boolean {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const tl = { x: r.minX, y: r.minY };
  const tr = { x: r.maxX, y: r.minY };
  const br = { x: r.maxX, y: r.maxY };
  const bl = { x: r.minX, y: r.maxY };
  return (
    segmentsIntersect(a, b, tl, tr) ||
    segmentsIntersect(a, b, tr, br) ||
    segmentsIntersect(a, b, br, bl) ||
    segmentsIntersect(a, b, bl, tl)
  );
}

/** Number of samples used to approximate curved entities (circle/arc/ellipse). */
const CURVE_SAMPLES = 32;

/**
 * Plane-space sample points and segments for an element. Curves are polyline-
 * approximated; closed shapes include the closing segment. `points` drive the
 * window test (all must be inside) and the crossing point test; `segments` drive
 * the crossing edge-intersection test.
 */
export function elementSamples(element: SketchElement): {
  points: Point2D[];
  segments: [Point2D, Point2D][];
} {
  const polyline = (pts: Point2D[], closed: boolean): { points: Point2D[]; segments: [Point2D, Point2D][] } => {
    const segments: [Point2D, Point2D][] = [];
    for (let i = 0; i < pts.length - 1; i++) segments.push([pts[i], pts[i + 1]]);
    if (closed && pts.length > 1) segments.push([pts[pts.length - 1], pts[0]]);
    return { points: pts, segments };
  };

  switch (element.type) {
    case SketchElementType.LINE:
      return polyline([element.start, element.end], false);

    case SketchElementType.RECTANGLE: {
      const { corner1, corner2 } = element;
      const pts = [
        corner1,
        { x: corner2.x, y: corner1.y },
        corner2,
        { x: corner1.x, y: corner2.y },
      ];
      return polyline(pts, true);
    }

    case SketchElementType.POLYGON:
      return polyline(element.points, true);

    case SketchElementType.CIRCLE: {
      const pts: Point2D[] = [];
      for (let i = 0; i < CURVE_SAMPLES; i++) {
        const a = (i / CURVE_SAMPLES) * Math.PI * 2;
        pts.push({ x: element.center.x + Math.cos(a) * element.radius, y: element.center.y + Math.sin(a) * element.radius });
      }
      return polyline(pts, true);
    }

    case SketchElementType.ELLIPSE: {
      const pts: Point2D[] = [];
      const rot = element.rotation || 0;
      for (let i = 0; i < CURVE_SAMPLES; i++) {
        const a = (i / CURVE_SAMPLES) * Math.PI * 2;
        const x = Math.cos(a) * element.majorRadius;
        const y = Math.sin(a) * element.minorRadius;
        pts.push({
          x: element.center.x + x * Math.cos(rot) - y * Math.sin(rot),
          y: element.center.y + x * Math.sin(rot) + y * Math.cos(rot),
        });
      }
      return polyline(pts, true);
    }

    case SketchElementType.ARC: {
      if (
        element.center &&
        typeof element.radius === 'number' &&
        typeof element.startAngle === 'number' &&
        typeof element.endAngle === 'number'
      ) {
        const pts: Point2D[] = [];
        const { center, radius, startAngle, endAngle } = element;
        for (let i = 0; i <= CURVE_SAMPLES; i++) {
          const a = startAngle + (endAngle - startAngle) * (i / CURVE_SAMPLES);
          pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
        }
        return polyline(pts, false);
      }
      if (element.points && element.points.length === 3) {
        return polyline(element.points, false);
      }
      return { points: [], segments: [] };
    }

    case SketchElementType.POINT:
      return { points: [{ x: element.x, y: element.y }], segments: [] };

    default:
      return { points: [], segments: [] };
  }
}

/**
 * Ids of the elements selected by a screen-space box.
 * - **window**: every sample point of the entity lies inside the rectangle.
 * - **crossing**: any sample point is inside, OR any edge crosses the rectangle.
 */
export function selectElementsInBox(
  elements: SketchElement[],
  rect: ScreenRect,
  mode: BoxMode,
  project: (p: Point2D) => ScreenPoint
): string[] {
  const result: string[] = [];

  for (const element of elements) {
    const { points, segments } = elementSamples(element);
    if (points.length === 0) continue;
    const screenPoints = points.map(project);

    if (mode === BoxMode.Window) {
      if (screenPoints.every((p) => pointInRect(p, rect))) result.push(element.id);
      continue;
    }

    // crossing
    let hit = screenPoints.some((p) => pointInRect(p, rect));
    if (!hit) {
      for (const [a, b] of segments) {
        if (segmentIntersectsRect(project(a), project(b), rect)) {
          hit = true;
          break;
        }
      }
    }
    if (hit) result.push(element.id);
  }

  return result;
}
