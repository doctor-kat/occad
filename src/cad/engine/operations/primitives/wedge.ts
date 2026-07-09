type TopoDS_Shape = any;
import type { PrimitiveWedgeParams } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';

/** Build a wedge solid at the world origin. */
export function buildWedge(ctx: WorkerContext, p: PrimitiveWedgeParams): TopoDS_Shape {
  const { oc } = ctx;
  const maker = new oc.BRepPrimAPI_MakeWedge_1(p.width, p.height, p.depth, p.ltx);
  const shape = maker.Shape();
  maker.delete();
  return shape;
}
