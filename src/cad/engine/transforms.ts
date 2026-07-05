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
import type { WorkerContext } from './workerContext';
import type { TransformParams } from '@/cad/types';
import { TransformOperation } from '@/cad/types';

const DEG2RAD = Math.PI / 180;

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
      case TransformOperation.MOVE: {
        const t = params.translation;
        if (!t) throw new Error('Move requires a translation vector');
        const vec = new oc.gp_Vec_4(t.x, t.y, t.z);
        trsf.SetTranslation_1(vec);
        vec.delete();
        break;
      }
      case TransformOperation.ROTATE: {
        const r = params.rotation;
        if (!r) throw new Error('Rotate requires an axis and angle');
        const origin = new oc.gp_Pnt_3(r.axis.origin.x, r.axis.origin.y, r.axis.origin.z);
        const dir = new oc.gp_Dir_4(r.axis.direction.x, r.axis.direction.y, r.axis.direction.z);
        const axis = new oc.gp_Ax1_2(origin, dir);
        trsf.SetRotation_1(axis, r.angle * DEG2RAD);
        origin.delete();
        dir.delete();
        axis.delete();
        break;
      }
      case TransformOperation.MIRROR: {
        const m = params.mirrorPlane;
        if (!m) throw new Error('Mirror requires a plane');
        const origin = new oc.gp_Pnt_3(m.origin.x, m.origin.y, m.origin.z);
        const normal = new oc.gp_Dir_4(m.direction.x, m.direction.y, m.direction.z);
        const plane = new oc.gp_Ax2_3(origin, normal);
        trsf.SetMirror_3(plane);
        origin.delete();
        normal.delete();
        plane.delete();
        break;
      }
      case TransformOperation.SCALE: {
        const s = params.scale;
        if (!s) throw new Error('Scale requires a factor and center');
        if (!(s.factor > 0)) throw new Error('Scale factor must be positive');
        const center = new oc.gp_Pnt_3(s.center.x, s.center.y, s.center.z);
        trsf.SetScale(center, s.factor);
        center.delete();
        break;
      }
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
