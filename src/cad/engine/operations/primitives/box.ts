type TopoDS_Shape = any;
import type { PrimitiveBoxParams } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';

/** Build a box solid at the world origin. */
export function buildBox(ctx: WorkerContext, p: PrimitiveBoxParams): TopoDS_Shape {
  const { oc } = ctx;
  const maker = new oc.BRepPrimAPI_MakeBox_2(p.width, p.height, p.depth);
  const shape = maker.Shape();
  maker.delete();
  return shape;
}
