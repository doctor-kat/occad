/**
 * Sweep operation
 *
 * Engine handler for the "Advanced modeling" sweep feature. Unlike
 * modifications/transforms (which act on the current body in place), sweep
 * produces a *standalone* solid from a sketch profile, which `handleRebuild`
 * then boolean-combines with the accumulated body (union for a boss, subtract
 * for a cut) — the same pattern as extrude/revolve.
 *
 *  - Sweep: a closed profile face is swept along a path/spine wire
 *    (`BRepOffsetAPI_MakePipe`).
 */

type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import { ensureFace, ensureWire } from '../helpers';

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
