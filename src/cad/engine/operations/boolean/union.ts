type TopoDS_Shape = any;
import type { WorkerContext } from '../../workerContext';

/**
 * Fuse two shapes. A failed fuse still needs to produce *a* body so the rebuild
 * can continue; fall back to an unfused compound of both inputs (visibly wrong,
 * but not a crash) rather than silently discarding one shape.
 */
export function performUnion(
  ctx: WorkerContext,
  shape1: TopoDS_Shape,
  shape2: TopoDS_Shape
): TopoDS_Shape {
  const { oc } = ctx;
  const progressRange = new oc.Message_ProgressRange_1();
  try {
    const fuse = new oc.BRepAlgoAPI_Fuse_3(shape1, shape2, progressRange);
    if (fuse.IsDone()) {
      const res = fuse.Shape();
      fuse.delete();
      return res;
    }
    fuse.delete();
    const comp = new oc.TopoDS_Compound();
    const builder = new oc.BRep_Builder();
    builder.MakeCompound(comp);
    builder.Add(comp, shape1);
    builder.Add(comp, shape2);
    builder.delete();
    return comp;
  } finally {
    progressRange.delete();
  }
}
