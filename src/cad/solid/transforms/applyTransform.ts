/**
 * Transform Operations
 *
 * Engine handlers for the "Transforms" feature family: move, rotate, mirror,
 * and scale. Like modifications (see `modifications.ts`), transforms act on the
 * *current* body in place rather than producing a standalone solid to boolean-
 * combine — during a parametric rebuild they receive the accumulated body and
 * return the transformed body, which becomes the new current body.
 *
 * Each transform builds a `gp_Trsf` and applies it via
 * `BRepBuilderAPI_Transform`. A non-uniform/rigid distinction matters for scale
 * vs. the others, but `gp_Trsf.SetScale` is uniform-only, which is all the UI
 * exposes, so a single `BRepBuilderAPI_Transform` path covers every case.
 */

type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import type { TransformParams } from '@/cad/types';
import { TransformOperation } from '@/cad/types';
import { buildMoveTrsf } from './move';
import { buildRotateTrsf } from './rotate';
import { buildMirrorTrsf } from './mirror';
import { buildScaleTrsf } from './scale';

/**
 * Apply the transform described by `params` to `shape`, returning the
 * transformed shape. Throws on malformed params or an OCC failure.
 */
export function applyTransform(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: TransformParams
): TopoDS_Shape {
  const { oc } = ctx;
  const trsf = new oc.gp_Trsf_1();

  try {
    switch (params.type) {
      case TransformOperation.MOVE:
        buildMoveTrsf(ctx, trsf, params);
        break;
      case TransformOperation.ROTATE:
        buildRotateTrsf(ctx, trsf, params);
        break;
      case TransformOperation.MIRROR:
        buildMirrorTrsf(ctx, trsf, params);
        break;
      case TransformOperation.SCALE:
        buildScaleTrsf(ctx, trsf, params);
        break;
      default:
        throw new Error(`Unknown transform type: ${(params as TransformParams).type}`);
    }

    const maker = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
    if (!maker.IsDone()) {
      maker.delete();
      throw new Error('Transform failed (BRepBuilderAPI_Transform not done)');
    }
    const result = maker.Shape();
    maker.delete();
    return result;
  } finally {
    trsf.delete();
  }
}
