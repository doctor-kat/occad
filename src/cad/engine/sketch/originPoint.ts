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
