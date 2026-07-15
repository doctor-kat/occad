import type { Point2D, SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import { sub, mid } from '@/cad/sketch/geometry';
import type { ResolvedEdge, ConstraintIconPlacement } from '@/cad/types';

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

/** The source element a primitive sub-id (`elId`, `elId_p2`, `elId_l1`, …) belongs to. */
function ownerElement(id: string, elements: SketchElement[]): SketchElement | null {
  const exact = elements.find((e) => e.id === id);
  if (exact) return exact;
  return (
    elements
      .filter((e) => id.startsWith(`${e.id}_`))
      .sort((a, b) => b.id.length - a.id.length)[0] ?? null
  );
}

/** Resolve any primitive id used in a constraint to a point on its source element. */
export function resolveEntityPoint(id: string, elements: SketchElement[]): Point2D | null {
  const exact = elements.find((e) => e.id === id);
  if (exact) return elementCenter(exact);

  const owner = ownerElement(id, elements);
  if (!owner) return null;
  return resolveSuffix(owner, id.slice(owner.id.length + 1));
}

/** The straight edge a primitive sub-id refers to (whole line or one
 *  rectangle/polygon edge), used to offset badges perpendicular to the entity
 *  instead of always "up" — a vertical line's badge should sit beside it, not
 *  further up the line. */
function resolveEdge(id: string, elements: SketchElement[]): ResolvedEdge | null {
  const exact = elements.find((e) => e.id === id);
  if (exact?.type === SketchElementType.LINE) {
    return { dir: sub(exact.end, exact.start), mid: mid(exact.start, exact.end) };
  }

  const owner = elements
    .filter((e) => id.startsWith(`${e.id}_`))
    .sort((a, b) => b.id.length - a.id.length)[0];
  if (!owner) return null;
  const suffix = id.slice(owner.id.length + 1);

  if (owner.type === SketchElementType.LINE) {
    if (suffix === 'p1' || suffix === 'p2') return { dir: sub(owner.end, owner.start), mid: mid(owner.start, owner.end) };
    return null;
  }
  if (owner.type === SketchElementType.RECTANGLE) {
    const corners = rectCorners(owner);
    const lm = suffix.match(/^l([1-4])$/);
    if (lm) {
      const i = Number(lm[1]) - 1;
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      return { dir: sub(b, a), mid: mid(a, b), shapeCenter: elementCenter(owner) ?? undefined };
    }
  }
  if (owner.type === SketchElementType.POLYGON) {
    const lm = suffix.match(/^l(\d+)$/);
    if (lm) {
      const i = Number(lm[1]);
      const a = owner.points[i];
      const b = owner.points[(i + 1) % owner.points.length];
      return a && b ? { dir: sub(b, a), mid: mid(a, b), shapeCenter: elementCenter(owner) ?? undefined } : null;
    }
  }
  return null;
}

/** Primitive ids a constraint references — direct `*_id` fields (`l_id`, `p1_id`, …)
 *  plus the nested `o_id` planegcs uses inside `param1`/`param2` for `difference`
 *  (horizontal/vertical-distance) constraints, which otherwise resolve no entity at all. */
function referencedIds(constraint: Record<string, any>): string[] {
  const ids: string[] = [];
  for (const [key, value] of Object.entries(constraint)) {
    if (key.endsWith('_id') && typeof value === 'string') ids.push(value);
    else if (value && typeof value === 'object' && typeof value.o_id === 'string') ids.push(value.o_id);
  }
  return ids;
}

/** Unit vector perpendicular to `dir`, flipped to face away from `shapeCenter`
 *  (when given) so a shape's edges all offset outward instead of alternating
 *  in/out depending on winding. */
function outwardPerp(dir: Point2D, edgeMid: Point2D, shapeCenter?: Point2D): Point2D | null {
  const l = Math.hypot(dir.x, dir.y);
  if (l === 0) return null;
  let perp: Point2D = { x: -dir.y / l, y: dir.x / l };
  if (shapeCenter) {
    const outward = sub(edgeMid, shapeCenter);
    if (perp.x * outward.x + perp.y * outward.y < 0) perp = { x: -perp.x, y: -perp.y };
  }
  return perp;
}

/** Unit vector perpendicular to the constrained entity's edge — facing outward
 *  from the shape when the edge belongs to one — or straight up `(0, 1)` when
 *  no single straight edge can be resolved (e.g. a circle). */
export function badgeOffsetDirection(constraint: Record<string, any>, elements: SketchElement[]): Point2D {
  const ids = referencedIds(constraint);

  // A distance-style constraint referencing exactly two points (e.g. a p2p_distance
  // dimensioning a rectangle's edge by its corner points, `R_p1`/`R_p4`) has no
  // dedicated edge sub-id (`R_l4`) to look up — resolveEdge below only recognizes
  // the canonical `l1..l4`/`li` edge suffixes. Derive the direction straight from
  // the two points themselves instead, which works regardless of how they're named.
  if (ids.length === 2) {
    const [a, b] = ids.map((id) => resolveEntityPoint(id, elements));
    if (a && b) {
      const ownerA = ownerElement(ids[0], elements);
      const ownerB = ownerElement(ids[1], elements);
      const sharedMultiEdgeOwner =
        ownerA && ownerA === ownerB
        && (ownerA.type === SketchElementType.RECTANGLE || ownerA.type === SketchElementType.POLYGON)
          ? (elementCenter(ownerA) ?? undefined)
          : undefined;
      const perp = outwardPerp(sub(b, a), mid(a, b), sharedMultiEdgeOwner);
      if (perp) return perp;
    }
  }

  for (const id of ids) {
    const edge = resolveEdge(id, elements);
    if (edge) {
      const perp = outwardPerp(edge.dir, edge.mid, edge.shapeCenter);
      if (perp) return perp;
    }
  }
  return { x: 0, y: 1 };
}

/** Average of the points referenced by a constraint (its anchor). */
export function constraintAnchor(
  constraint: Record<string, any>,
  elements: SketchElement[]
): Point2D | null {
  const points: Point2D[] = [];
  for (const id of referencedIds(constraint)) {
    const p = resolveEntityPoint(id, elements);
    if (p) points.push(p);
  }
  if (points.length === 0) return null;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

/**
 * Placement for each constraint's badge: offset from its entity midpoint, perpendicular
 * to the entity (so a vertical line's badge sits beside it, not further up the line).
 * Constraints sharing an anchor (e.g. several relations on one edge) stack in a vertical
 * column centered on that offset point — same `x`, evenly spread `y` — so a group of
 * badges reads as a clean list beside its entity instead of drifting diagonally.
 * Constraints whose entities can't be resolved (e.g. a deleted element) are dropped.
 */
export function constraintIconPlacements(
  constraints: Array<Record<string, any>>,
  elements: SketchElement[],
  opts: { offset?: number; spacing?: number } = {}
): ConstraintIconPlacement[] {
  const { offset = 3, spacing = 3 } = opts;
  const groups = new Map<string, { id: string; type: string; base: Point2D }[]>();

  for (const c of constraints) {
    const anchor = constraintAnchor(c, elements);
    if (!anchor || typeof c.id !== 'string') continue;
    const dir = badgeOffsetDirection(c, elements);
    const base = { x: anchor.x + dir.x * offset, y: anchor.y + dir.y * offset };
    const key = `${Math.round(anchor.x)},${Math.round(anchor.y)}`;
    const group = groups.get(key) ?? [];
    group.push({ id: c.id, type: String(c.type), base });
    groups.set(key, group);
  }

  const placementById = new Map<string, ConstraintIconPlacement>();
  for (const group of groups.values()) {
    const n = group.length;
    // Stack straight up/down, centered on the (perpendicular) base offset point, so
    // every badge in the group shares the same x — never a diagonal drift.
    group.forEach((item, i) => {
      const y = item.base.y + spacing * (i - (n - 1) / 2);
      placementById.set(item.id, { id: item.id, type: item.type, x: item.base.x, y });
    });
  }

  const out: ConstraintIconPlacement[] = [];
  for (const c of constraints) {
    if (typeof c.id === 'string' && placementById.has(c.id)) out.push(placementById.get(c.id)!);
  }

  return out;
}
