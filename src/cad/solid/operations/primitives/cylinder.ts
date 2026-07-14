type TopoDS_Shape = any;
import type { PrimitiveCylinderParams } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';

/** Build a cylinder solid at the world origin. */
export function buildCylinder(ctx: WorkerContext, p: PrimitiveCylinderParams): TopoDS_Shape {
  const { oc } = ctx;
  const maker = new oc.BRepPrimAPI_MakeCylinder_1(p.radius, p.height);
  const shape = maker.Shape();
  maker.delete();
  return shape;
}
