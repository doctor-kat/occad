import type { Point2D, SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';

/**
 * Screen anchors for constraint badges. Each sketch constraint (a planegcs object
 * referencing primitive sub-ids) gets a tiny clickable square placed slightly
 * *above* the midpoint of the entity it constrains. This is the inverse of
 * `mapElementsToPrimitives`: it maps a primitive id back to a point on the source
 * `SketchElement`.
 *
 * Pure (no THREE/React) so the placement math is unit-testable.
 */

/** A representative point for a whole element (used when a constraint targets it by id). */
function elementCenter(el: SketchElement): Point2D | null {
  switch (el.type) {
    case SketchElementType.LINE:
      return { x: (el.start.x + el.end.x) / 2, y: (el.start.y + el.end.y) / 2 };
    case SketchElementType.CIRCLE:
    case SketchElementType.ELLIPSE:
      return el.center;
    case SketchElementType.ARC:
      if (el.center) return el.center;
      if (el.points && el.points.length) {
        const n = el.points.length;
        return {
          x: el.points.reduce((s, p) => s + p.x, 0) / n,
          y: el.points.reduce((s, p) => s + p.y, 0) / n,
        };
      }
      return null;
    case SketchElementType.RECTANGLE:
      return { x: (el.corner1.x + el.corner2.x) / 2, y: (el.corner1.y + el.corner2.y) / 2 };
    case SketchElementType.POLYGON: {
      if (!el.points.length) return null;
      const n = el.points.length;
      return {
        x: el.points.reduce((s, p) => s + p.x, 0) / n,
        y: el.points.reduce((s, p) => s + p.y, 0) / n,
      };
    }
    default:
      return null;
  }
}

const mid = (a: Point2D, b: Point2D): Point2D => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** The four corners of a rectangle, in the same order mapElementsToPrimitives mints p1..p4. */
function rectCorners(el: Extract<SketchElement, { type: SketchElementType.RECTANGLE }>): Point2D[] {
  return [
    el.corner1,
    { x: el.corner2.x, y: el.corner1.y },
    el.corner2,
    { x: el.corner1.x, y: el.corner2.y },
  ];
}

/** Resolve a primitive sub-id (`elId`, `elId_p2`, `elId_l1`, `elId_center`, …) to a point. */
function resolveSuffix(el: SketchElement, suffix: string): Point2D | null {
  if (suffix === 'center') return elementCenter(el);

  if (el.type === SketchElementType.LINE) {
    if (suffix === 'p1') return el.start;
    if (suffix === 'p2') return el.end;
  }

  if (el.type === SketchElementType.RECTANGLE) {
    const corners = rectCorners(el);
    const pm = suffix.match(/^p([1-4])$/);
    if (pm) return corners[Number(pm[1]) - 1];
    const lm = suffix.match(/^l([1-4])$/);
    if (lm) {
      const i = Number(lm[1]) - 1;
      return mid(corners[i], corners[(i + 1) % 4]);
    }
  }

  if (el.type === SketchElementType.POLYGON) {
    const pm = suffix.match(/^p(\d+)$/);
    if (pm) return el.points[Number(pm[1])] ?? null;
    const lm = suffix.match(/^l(\d+)$/);
    if (lm) {
      const i = Number(lm[1]);
      const a = el.points[i];
      const b = el.points[(i + 1) % el.points.length];
      return a && b ? mid(a, b) : null;
    }
  }

  return null;
}

/** Resolve any primitive id used in a constraint to a point on its source element. */
export function resolveEntityPoint(id: string, elements: SketchElement[]): Point2D | null {
  const exact = elements.find((e) => e.id === id);
  if (exact) return elementCenter(exact);

  // Longest element-id prefix wins (ids are `${elementId}_${suffix}`).
  const owner = elements
    .filter((e) => id.startsWith(`${e.id}_`))
    .sort((a, b) => b.id.length - a.id.length)[0];
  if (!owner) return null;
  return resolveSuffix(owner, id.slice(owner.id.length + 1));
}

/** Average of the points referenced by a constraint's `*_id` fields (its anchor). */
export function constraintAnchor(
  constraint: Record<string, any>,
  elements: SketchElement[]
): Point2D | null {
  const points: Point2D[] = [];
  for (const [key, value] of Object.entries(constraint)) {
    if (key.endsWith('_id') && typeof value === 'string') {
      const p = resolveEntityPoint(value, elements);
      if (p) points.push(p);
    }
  }
  if (points.length === 0) return null;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

export interface ConstraintIconPlacement {
  id: string;
  type: string;
  x: number;
  y: number;
}

/**
 * Placement for each constraint's badge: slightly above its entity midpoint.
 * Constraints sharing an anchor (e.g. several relations on one edge) are stacked
 * upward by `spacing` so their squares don't overlap. Constraints whose entities
 * can't be resolved (e.g. a deleted element) are dropped.
 */
export function constraintIconPlacements(
  constraints: Array<Record<string, any>>,
  elements: SketchElement[],
  opts: { offset?: number; spacing?: number } = {}
): ConstraintIconPlacement[] {
  const { offset = 3, spacing = 3 } = opts;
  const stack = new Map<string, number>();
  const out: ConstraintIconPlacement[] = [];

  for (const c of constraints) {
    const anchor = constraintAnchor(c, elements);
    if (!anchor || typeof c.id !== 'string') continue;
    const key = `${Math.round(anchor.x)},${Math.round(anchor.y)}`;
    const idx = stack.get(key) ?? 0;
    stack.set(key, idx + 1);
    out.push({ id: c.id, type: String(c.type), x: anchor.x, y: anchor.y + offset + idx * spacing });
  }

  return out;
}
