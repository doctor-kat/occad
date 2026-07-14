type TopoDS_Shape = any;
import type { PrimitiveTorusParams } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';

/** Build a torus solid at the world origin. */
export function buildTorus(ctx: WorkerContext, p: PrimitiveTorusParams): TopoDS_Shape {
  const { oc } = ctx;
  const maker = new oc.BRepPrimAPI_MakeTorus_1(p.majorRadius, p.minorRadius);
  const shape = maker.Shape();
  maker.delete();
  return shape;
}
