/**
 * Move transform: builds a `gp_Trsf` translation from `params.translation`.
 */

import type { WorkerContext } from '../workerContext';
import type { TransformParams } from '@/cad/types';

export function buildMoveTrsf(ctx: WorkerContext, trsf: any, params: TransformParams): void {
  const { oc } = ctx;
  const t = params.translation;
  if (!t) throw new Error('Move requires a translation vector');
  const vec = new oc.gp_Vec_4(t.x, t.y, t.z);
  trsf.SetTranslation_1(vec);
  vec.delete();
}
