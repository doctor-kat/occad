/**
 * Primitive solid dispatcher.
 */

type TopoDS_Shape = any;
import type {
  PrimitiveBoxParams,
  PrimitiveCylinderParams,
  PrimitiveSphereParams,
  PrimitiveConeParams,
  PrimitiveTorusParams,
  PrimitiveWedgeParams,
  Point3D,
} from '@/cad/types';
import { FeatureOperation } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';
import { buildBox } from './box';
import { buildCylinder } from './cylinder';
import { buildSphere } from './sphere';
import { buildCone } from './cone';
import { buildTorus } from './torus';
import { buildWedge } from './wedge';

/**
 * Build a standalone primitive solid (box / cylinder / sphere / cone / torus /
 * wedge) from its parameters. Each primitive is centered/anchored via its
 * `center` param (default origin). Extracted from `handleRebuild` so the
 * type→OCC-constructor dispatch is unit-testable with a mocked kernel.
 *
 * Returns null when the primitive fails to build (e.g. degenerate params);
 * callers treat that as a no-op so one bad primitive can't abort the rebuild.
 */
export function buildPrimitiveShape(
  ctx: WorkerContext,
  type: FeatureOperation,
  params:
    | PrimitiveBoxParams
    | PrimitiveCylinderParams
    | PrimitiveSphereParams
    | PrimitiveConeParams
    | PrimitiveTorusParams
    | PrimitiveWedgeParams
): TopoDS_Shape | null {
  const { oc } = ctx;

  // Build each primitive at the world origin with its simplest ("_1"/box "_2")
  // scalar constructor. We deliberately avoid the gp_Ax2 placement overloads:
  // opencascade.js's runtime overload numbering does NOT match the shipped
  // .d.ts for the MakeOneAxis family (the existing cylinder uses `_2` for what
  // the typings call `_3`), so the scalar forms are the only ones we can call
  // by number without risking a BindingError. Positioning is done afterwards
  // with a translation to the requested `center`.
  let shape: TopoDS_Shape | null = null;
  switch (type) {
    case FeatureOperation.BOX:
      shape = buildBox(ctx, params as PrimitiveBoxParams);
      break;
    case FeatureOperation.CYLINDER:
      shape = buildCylinder(ctx, params as PrimitiveCylinderParams);
      break;
    case FeatureOperation.SPHERE:
      shape = buildSphere(ctx, params as PrimitiveSphereParams);
      break;
    case FeatureOperation.CONE:
      shape = buildCone(ctx, params as PrimitiveConeParams);
      break;
    case FeatureOperation.TORUS:
      shape = buildTorus(ctx, params as PrimitiveTorusParams);
      break;
    case FeatureOperation.WEDGE:
      shape = buildWedge(ctx, params as PrimitiveWedgeParams);
      break;
    default:
      return null;
  }

  if (!shape) return null;

  // Offset to the requested center (if any) — everything above is origin-built.
  const c = (params as { center?: Point3D }).center;
  if (c && (c.x || c.y || c.z)) {
    const trsf = new oc.gp_Trsf_1();
    const vec = new oc.gp_Vec_4(c.x || 0, c.y || 0, c.z || 0);
    trsf.SetTranslation_1(vec);
    const maker = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
    const moved = maker.IsDone() ? maker.Shape() : shape;
    maker.delete();
    vec.delete();
    trsf.delete();
    return moved;
  }
  return shape;
}
