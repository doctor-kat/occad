type TopoDS_Shape = any;
import type { PrimitiveConeParams } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';

/** Build a cone solid at the world origin. */
export function buildCone(ctx: WorkerContext, p: PrimitiveConeParams): TopoDS_Shape {
  const { oc } = ctx;
  const maker = new oc.BRepPrimAPI_MakeCone_1(p.radius1, p.radius2, p.height);
  const shape = maker.Shape();
  maker.delete();
  return shape;
}
