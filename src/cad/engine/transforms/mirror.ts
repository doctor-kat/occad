/**
 * Mirror transform: builds a `gp_Trsf` mirror from `params.mirrorPlane`
 * (point and normal).
 */

import type { WorkerContext } from '../workerContext';
import type { TransformParams } from '@/cad/types';

export function buildMirrorTrsf(ctx: WorkerContext, trsf: any, params: TransformParams): void {
  const { oc } = ctx;
  const m = params.mirrorPlane;
  if (!m) throw new Error('Mirror requires a plane');
  const origin = new oc.gp_Pnt_3(m.origin.x, m.origin.y, m.origin.z);
  const normal = new oc.gp_Dir_4(m.direction.x, m.direction.y, m.direction.z);
  const plane = new oc.gp_Ax2_3(origin, normal);
  trsf.SetMirror_3(plane);
  origin.delete();
  normal.delete();
  plane.delete();
}
