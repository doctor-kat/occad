type TopoDS_Shape = any;
import type { WorkerContext } from '../../workerContext';

/** Cut shape2 out of shape1. */
export function performSubtract(
  ctx: WorkerContext,
  shape1: TopoDS_Shape,
  shape2: TopoDS_Shape
): TopoDS_Shape {
  const { oc } = ctx;
  const progressRange = new oc.Message_ProgressRange_1();
  try {
    const cut = new oc.BRepAlgoAPI_Cut_3(shape1, shape2, progressRange);
    if (!cut.IsDone()) { cut.delete(); throw new Error('BRepAlgoAPI_Cut failed'); }
    const res = cut.Shape();
    cut.delete();
    return res;
  } finally {
    progressRange.delete();
  }
}
