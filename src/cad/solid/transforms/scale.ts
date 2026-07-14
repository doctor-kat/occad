/**
 * Scale transform: builds a `gp_Trsf` uniform scale from `params.scale`
 * (factor and center point). `gp_Trsf.SetScale` is uniform-only, which is
 * all the UI exposes.
 */

import type { WorkerContext } from '../workerContext';
import type { TransformParams } from '@/cad/types';

export function buildScaleTrsf(ctx: WorkerContext, trsf: any, params: TransformParams): void {
  const { oc } = ctx;
  const s = params.scale;
  if (!s) throw new Error('Scale requires a factor and center');
  if (!(s.factor > 0)) throw new Error('Scale factor must be positive');
  const center = new oc.gp_Pnt_3(s.center.x, s.center.y, s.center.z);
  trsf.SetScale(center, s.factor);
  center.delete();
}
