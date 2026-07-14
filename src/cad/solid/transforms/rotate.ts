/**
 * Rotate transform: builds a `gp_Trsf` rotation from `params.rotation`
 * (axis + angle in degrees).
 */

import type { WorkerContext } from '../workerContext';
import type { TransformParams } from '@/cad/types';

const DEG2RAD = Math.PI / 180;

export function buildRotateTrsf(ctx: WorkerContext, trsf: any, params: TransformParams): void {
  const { oc } = ctx;
  const r = params.rotation;
  if (!r) throw new Error('Rotate requires an axis and angle');
  const origin = new oc.gp_Pnt_3(r.axis.origin.x, r.axis.origin.y, r.axis.origin.z);
  const dir = new oc.gp_Dir_4(r.axis.direction.x, r.axis.direction.y, r.axis.direction.z);
  const axis = new oc.gp_Ax1_2(origin, dir);
  trsf.SetRotation_1(axis, r.angle * DEG2RAD);
  origin.delete();
  dir.delete();
  axis.delete();
}
