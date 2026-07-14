type TopoDS_Shape = any;
import type { PrimitiveSphereParams } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';

/** Build a sphere solid at the world origin. */
export function buildSphere(ctx: WorkerContext, p: PrimitiveSphereParams): TopoDS_Shape {
  const { oc } = ctx;
  const maker = new oc.BRepPrimAPI_MakeSphere_1(p.radius);
  const shape = maker.Shape();
  maker.delete();
  return shape;
}
