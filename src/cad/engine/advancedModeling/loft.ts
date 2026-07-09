/**
 * Loft operation
 *
 * Engine handler for the "Advanced modeling" loft feature. Unlike
 * modifications/transforms (which act on the current body in place), loft
 * produces a *standalone* solid from a series of sketch profiles, which
 * `handleRebuild` then boolean-combines with the accumulated body (union for
 * a boss, subtract for a cut) — the same pattern as extrude/revolve.
 *
 *  - Loft: a solid is built through a series of section wires
 *    (`BRepOffsetAPI_ThruSections`).
 */

type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import { ensureWire } from '../helpers';

/**
 * Loft a solid through the ordered `profileShapes` (each → section wire) via
 * `BRepOffsetAPI_ThruSections`. Requires at least two profiles. Throws on an
 * OCC failure or too few profiles.
 */
export function applyLoft(
  ctx: WorkerContext,
  profileShapes: TopoDS_Shape[],
  ruled = false
): TopoDS_Shape {
  const { oc } = ctx;
  if (profileShapes.length < 2) {
    throw new Error('Loft requires at least two profiles');
  }

  // isSolid=true so closed sections produce a solid (not just a shell); pres is
  // the section-continuity tolerance.
  const maker = new oc.BRepOffsetAPI_ThruSections(true, ruled, 1.0e-6);
  for (const profile of profileShapes) {
    maker.AddWire(ensureWire(ctx, profile));
  }
  maker.Build(new oc.Message_ProgressRange_1());
  if (!maker.IsDone()) {
    maker.delete();
    throw new Error('Loft failed (BRepOffsetAPI_ThruSections not done)');
  }
  const shape = maker.Shape();
  maker.delete();
  return shape;
}
