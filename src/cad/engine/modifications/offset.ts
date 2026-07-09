type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import type { OffsetParams } from '@/cad/types';
import { OFFSET_TOL } from './shared';

/**
 * Offset the whole body outward (positive) or inward (negative) by a distance.
 * OCC: `BRepOffsetAPI_MakeOffsetShape`.
 */
export function applyOffset(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: OffsetParams
): TopoDS_Shape {
  const { oc } = ctx;
  if (!params.distance) throw new Error('Offset distance must be non-zero');

  const maker = new oc.BRepOffsetAPI_MakeOffsetShape();
  const progress = new oc.Message_ProgressRange_1();
  maker.PerformByJoin(
    shape,
    params.distance,
    OFFSET_TOL,
    oc.BRepOffset_Mode.BRepOffset_Skin,
    false,
    false,
    oc.GeomAbs_JoinType.GeomAbs_Arc,
    false,
    progress
  );
  const done = maker.IsDone();
  if (!done) {
    maker.delete();
    progress.delete();
    throw new Error('Offset failed (BRepOffsetAPI_MakeOffsetShape not done)');
  }
  const result = maker.Shape();
  maker.delete();
  progress.delete();
  return result;
}
