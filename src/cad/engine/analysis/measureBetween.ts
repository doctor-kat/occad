/**
 * measureBetween operation (ROADMAP §4)
 *
 * Computes the minimum distance (and, when applicable, the acute angle)
 * between two picked sub-shapes of a solid using
 * `BRepExtrema_DistShapeShape` for the closest-point pair and
 * `BRepAdaptor_Surface`/`Curve` for planar-face normals / line-edge tangents.
 *
 * Kept UI-agnostic: returns plain numbers the main thread formats for display.
 */

type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import type { MeasureBetweenData, MeasureSelection } from '@/cad/types';
import { SubShapeKind } from '@/cad/types';
import { mapSubShapes } from '../fingerprint';

type Vec3 = { x: number; y: number; z: number };

function toVec(d: { X(): number; Y(): number; Z(): number }): Vec3 {
  return { x: d.X(), y: d.Y(), z: d.Z() };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Acute angle (0–90°) between two unit directions. Sub-shape direction sign is
 * arbitrary (a face normal or edge tangent can point either way), so we fold to
 * the acute angle via |dot|. Returns undefined when (anti)parallel — the caller
 * only reports an angle for non-parallel selections.
 */
function acuteAngleDeg(a: Vec3, b: Vec3): number | undefined {
  const dot = Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z));
  if (dot > 0.99995) return undefined; // parallel within ~0.5°
  return (Math.acos(dot) * 180) / Math.PI;
}

/**
 * Measure the minimum distance between two picked sub-shapes, plus the acute
 * angle between them when both are directional (edge tangent / planar-face
 * normal) and non-parallel. Uses `BRepExtrema_DistShapeShape` for the
 * closest-point pair.
 */
export function measureBetween(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  a: MeasureSelection,
  b: MeasureSelection,
): MeasureBetweenData {
  const subA = subShapeAt(ctx, shape, a);
  const subB = subShapeAt(ctx, shape, b);

  const { distance, pointA, pointB } = computeDistance(ctx, subA, subB);
  const dirA = directionOf(ctx, subA, a.kind);
  const dirB = directionOf(ctx, subB, b.kind);
  const angle = dirA && dirB ? acuteAngleDeg(dirA, dirB) : undefined;

  return angle !== undefined ? { distance, pointA, pointB, angle } : { distance, pointA, pointB };
}

/** Resolve a selection to its concrete OCC sub-shape by ordinal index. */
function subShapeAt(ctx: WorkerContext, shape: TopoDS_Shape, sel: MeasureSelection): TopoDS_Shape {
  const subs = mapSubShapes(ctx, shape, sel.kind);
  if (sel.index < 0 || sel.index >= subs.length) {
    throw new Error(`${sel.kind} ${sel.index} not found`);
  }
  return subs[sel.index];
}

/** Minimum distance + closest-point pair via `BRepExtrema_DistShapeShape`. */
function computeDistance(
  ctx: WorkerContext,
  s1: TopoDS_Shape,
  s2: TopoDS_Shape,
): { distance: number; pointA: Vec3; pointB: Vec3 } {
  const { oc } = ctx;
  const range = new oc.Message_ProgressRange_1();
  const dss = new oc.BRepExtrema_DistShapeShape_2(
    s1,
    s2,
    oc.Extrema_ExtFlag.Extrema_ExtFlag_MIN,
    oc.Extrema_ExtAlgo.Extrema_ExtAlgo_Grad,
    range,
  );
  try {
    if (!dss.IsDone() || dss.NbSolution() < 1) throw new Error('distance computation failed');
    const p1 = dss.PointOnShape1(1);
    const p2 = dss.PointOnShape2(1);
    const pointA = { x: p1.X(), y: p1.Y(), z: p1.Z() };
    const pointB = { x: p2.X(), y: p2.Y(), z: p2.Z() };
    return { distance: dss.Value(), pointA, pointB };
  } finally {
    dss.delete?.();
    range.delete?.();
  }
}

/**
 * Direction of a selection for angle measurement: a planar face's unit normal
 * or a line edge's unit tangent. Undefined for curved faces/edges and vertices.
 */
function directionOf(ctx: WorkerContext, sub: TopoDS_Shape, kind: MeasureSelection['kind']): Vec3 | undefined {
  const { oc } = ctx;
  if (kind === SubShapeKind.Face) {
    const adaptor = new oc.BRepAdaptor_Surface_2(sub, true);
    let dir: Vec3 | undefined;
    if (adaptor.GetType() === oc.GeomAbs_SurfaceType.GeomAbs_Plane) {
      dir = normalize(toVec(adaptor.Plane().Axis().Direction()));
    }
    adaptor.delete?.();
    return dir;
  }
  if (kind === SubShapeKind.Edge) {
    const adaptor = new oc.BRepAdaptor_Curve_2(sub);
    let dir: Vec3 | undefined;
    if (adaptor.GetType() === oc.GeomAbs_CurveType.GeomAbs_Line) {
      dir = normalize(toVec(adaptor.Line().Direction()));
    }
    adaptor.delete?.();
    return dir;
  }
  return undefined;
}
