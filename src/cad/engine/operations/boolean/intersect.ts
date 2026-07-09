type TopoDS_Shape = any;
import type { WorkerContext } from '../../workerContext';

/** Keep the common volume of shape1 and shape2. */
export function performIntersect(
  ctx: WorkerContext,
  shape1: TopoDS_Shape,
  shape2: TopoDS_Shape
): TopoDS_Shape {
  const { oc } = ctx;
  const progressRange = new oc.Message_ProgressRange_1();
  try {
    const common = new oc.BRepAlgoAPI_Common_3(shape1, shape2, progressRange);
    if (!common.IsDone()) { common.delete(); throw new Error('BRepAlgoAPI_Common failed'); }
    const res = common.Shape();
    common.delete();
    return res;
  } finally {
    progressRange.delete();
  }
}
