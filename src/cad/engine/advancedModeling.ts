/**
 * Advanced Modeling Operations
 *
 * Engine handlers for the "Advanced modeling" feature family: sweep and loft.
 * Unlike modifications/transforms (which act on the current body in place),
 * sweep and loft each produce a *standalone* solid from sketch profiles, which
 * `handleRebuild` then boolean-combines with the accumulated body (union for a
 * boss, subtract for a cut) — the same pattern as extrude/revolve.
 *
 *  - Sweep: a closed profile face is swept along a path/spine wire
 *    (`BRepOffsetAPI_MakePipe`).
 *  - Loft: a solid is built through a series of section wires
 *    (`BRepOffsetAPI_ThruSections`).
 */

type TopoDS_Shape = any;
import type { WorkerContext } from './workerContext';
import { ensureFace, ensureWire } from './helpers';

/**
 * Sweep `profileShape` (a closed profile → face) along `pathShape` (→ wire),
 * returning the resulting solid. Throws on an OCC failure.
 */
export function applySweep(
  ctx: WorkerContext,
  profileShape: TopoDS_Shape,
  pathShape: TopoDS_Shape
): TopoDS_Shape {
  const { oc } = ctx;
  const profileFace = ensureFace(ctx, profileShape);
  const spine = ensureWire(ctx, pathShape);

  const pipe = new oc.BRepOffsetAPI_MakePipe_1(spine, profileFace);
  pipe.Build(new oc.Message_ProgressRange_1());
  if (!pipe.IsDone()) {
    pipe.delete();
    throw new Error('Sweep failed (BRepOffsetAPI_MakePipe not done)');
  }
  const shape = pipe.Shape();
  pipe.delete();
  return shape;
}

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
