import type { SketchElement, Point2D, PlanegcsConstraint } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import type { SketchPrimitiveDTO } from './elementsToPrimitives';

/**
 * The sketch origin — the (0,0) point of every sketch's workplane, mirroring the
 * world Origin reference geometry. It exists in each sketch as a *fixed* point
 * primitive so that drawn geometry can be constrained to it (e.g. a coincident
 * constraint when an endpoint is snapped to the origin). Its id is stable and
 * shared across sketches so constraints can reference it by name.
 */
export const ORIGIN_POINT_ID = 'origin';

/** The fixed origin point primitive at the sketch-local (0,0). */
export function makeOriginPrimitive(): SketchPrimitiveDTO {
  return { id: ORIGIN_POINT_ID, type: 'point', fixed: true, data: { x: 0, y: 0 } };
}

/**
 * Ensure a primitive list contains exactly one origin point primitive, prepended.
 * Any pre-existing origin (e.g. round-tripped from a previous solve) is dropped and
 * replaced by the canonical fixed one, so the origin never drifts or duplicates.
 */
export function withOriginPrimitive<T extends { id: string }>(
  primitives: T[]
): (T | SketchPrimitiveDTO)[] {
  return [makeOriginPrimitive(), ...primitives.filter((p) => p.id !== ORIGIN_POINT_ID)];
}

/** How close a point must be to (0,0) to count as sitting on the origin. */
const ORIGIN_EPSILON = 1e-6;

/** Whether a point sits on the sketch origin (used to infer coincidence). */
export function isAtOrigin(p: Point2D): boolean {
  return Math.abs(p.x) <= ORIGIN_EPSILON && Math.abs(p.y) <= ORIGIN_EPSILON;
}

/**
 * Named points on an element that a coincident-to-origin constraint can reference.
 * The ids must match the sub-primitive ids minted by `mapElementsToPrimitives`.
 */
function elementAnchorPoints(el: SketchElement): { id: string; point: Point2D }[] {
  switch (el.type) {
    case SketchElementType.POINT:
      return [{ id: el.id, point: { x: el.x, y: el.y } }];
    case SketchElementType.LINE:
      // Construction lines are reference-only and emit no primitives (see mapElementsToPrimitives).
      if (el.construction) return [];
      return [
        { id: `${el.id}_p1`, point: el.start },
        { id: `${el.id}_p2`, point: el.end },
      ];
    case SketchElementType.RECTANGLE:
      return [
        { id: `${el.id}_p1`, point: el.corner1 },
        { id: `${el.id}_p2`, point: { x: el.corner2.x, y: el.corner1.y } },
        { id: `${el.id}_p3`, point: el.corner2 },
        { id: `${el.id}_p4`, point: { x: el.corner1.x, y: el.corner2.y } },
      ];
    case SketchElementType.POLYGON:
      return el.points.map((p, i) => ({ id: `${el.id}_p${i}`, point: p }));
    case SketchElementType.CIRCLE:
    case SketchElementType.ELLIPSE:
      return [{ id: `${el.id}_center`, point: el.center }];
    case SketchElementType.ARC:
      return el.center ? [{ id: `${el.id}_center`, point: el.center }] : [];
    default:
      return [];
  }
}

/**
 * Coincident constraints implied by geometry landing on the origin — the
 * SolidWorks "coincident with origin" relation added when an endpoint/corner/
 * center is snapped to (0,0). One `p2p_coincident` per anchor point at the origin,
 * bound to the fixed origin point primitive (see {@link makeOriginPrimitive}).
 *
 * Deterministic ids (`${pointId}_origin_coincident`) make regenerating on every
 * edit idempotent, and each is tagged `auto: true` so callers keep it separate
 * from the user's manual constraints (mirrors `inferAutoConstraints`).
 */
export function inferOriginCoincidence(elements: SketchElement[]): PlanegcsConstraint[] {
  const out: PlanegcsConstraint[] = [];
  for (const el of elements) {
    for (const { id, point } of elementAnchorPoints(el)) {
      if (isAtOrigin(point)) {
        out.push({
          id: `${id}_origin_coincident`,
          type: 'p2p_coincident',
          p1_id: id,
          p2_id: ORIGIN_POINT_ID,
          auto: true,
        });
      }
    }
  }
  return out;
}
