/**
 * Selector descriptor extraction (ROADMAP §9.1, Phase 0).
 *
 * Turns an OCC body into {@link SubShapeDescriptor}s that the pure `evaluate`
 * engine matches selectors against. The base fields (geomType/measure/centroid/
 * obb) are delegated to the already-tested `fingerprint.computeFingerprint`; this
 * module adds the two selection-only extras:
 *
 *  - **direction** — the outward normal of a *planar* face (from the plane axis,
 *    flipped when the face is reversed), or the tangent of a *line* edge.
 *  - **radius** — for cylindrical/spherical faces and circular edges.
 *
 * Non-planar faces and non-line edges get no `direction` (directional selectors
 * simply won't match them — the correct, honest behaviour). A general D1-based
 * normal/tangent for curved sub-shapes is a deliberate follow-up (see TODO.md).
 *
 * Pure w.r.t. OCC: every kernel call goes through `ctx.oc`, so it runs in unit
 * tests against a faithful mock (no WASM). Real geometric validity is e2e-only.
 */

type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import { computeFingerprint } from '../fingerprint';
import type { SubShapeDescriptor, Vec3 } from './types';
import { SubShapeKind } from './types';

const toVec = (d: any): Vec3 => ({ x: d.X(), y: d.Y(), z: d.Z() });
/** Adding 0 collapses -0 → 0 so negated/zeroed components don't leak `-0`. */
const noNegZero = (n: number): number => n + 0;
const negate = (v: Vec3): Vec3 => ({ x: noNegZero(-v.x), y: noNegZero(-v.y), z: noNegZero(-v.z) });
function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: noNegZero(v.x / len), y: noNegZero(v.y / len), z: noNegZero(v.z / len) };
}

function shapeEnumFor(ctx: WorkerContext, kind: SubShapeKind): any {
  const e = ctx.oc.TopAbs_ShapeEnum;
  return kind === SubShapeKind.Edge ? e.TopAbs_EDGE : kind === SubShapeKind.Face ? e.TopAbs_FACE : e.TopAbs_VERTEX;
}

function castSubShape(ctx: WorkerContext, sub: TopoDS_Shape, kind: SubShapeKind): TopoDS_Shape {
  const { oc } = ctx;
  return kind === SubShapeKind.Edge ? oc.TopoDS.Edge_1(sub) : kind === SubShapeKind.Face ? oc.TopoDS.Face_1(sub) : oc.TopoDS.Vertex_1(sub);
}

/** Flatten the 1-based OCC sub-shape map to a 0-based array of cast sub-shapes. */
function mapSubShapes(ctx: WorkerContext, shape: TopoDS_Shape, kind: SubShapeKind): TopoDS_Shape[] {
  const { oc } = ctx;
  const map = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, shapeEnumFor(ctx, kind), map);
  const out: TopoDS_Shape[] = [];
  for (let i = 1; i <= map.Extent(); i++) out.push(castSubShape(ctx, map.FindKey(i), kind));
  map.delete();
  return out;
}

/** True when the sub-shape's stored orientation is REVERSED. */
function isReversed(ctx: WorkerContext, shape: TopoDS_Shape): boolean {
  const orient = shape.Orientation_1?.();
  return orient !== undefined && orient === ctx.oc.TopAbs_Orientation?.TopAbs_REVERSED;
}

/** Outward unit normal of a planar face; undefined for curved surfaces. */
function faceNormal(ctx: WorkerContext, face: TopoDS_Shape): Vec3 | undefined {
  const { oc } = ctx;
  const adaptor = new oc.BRepAdaptor_Surface_2(face, true);
  let dir: Vec3 | undefined;
  if (adaptor.GetType() === oc.GeomAbs_SurfaceType.GeomAbs_Plane) {
    dir = normalize(toVec(adaptor.Plane().Axis().Direction()));
    if (isReversed(ctx, face)) dir = negate(dir);
  }
  adaptor.delete?.();
  return dir;
}

/** Radius of a cylindrical/spherical face; undefined otherwise. */
function faceRadius(ctx: WorkerContext, face: TopoDS_Shape): number | undefined {
  const { oc } = ctx;
  const adaptor = new oc.BRepAdaptor_Surface_2(face, true);
  const S = oc.GeomAbs_SurfaceType;
  const t = adaptor.GetType();
  let r: number | undefined;
  if (t === S.GeomAbs_Cylinder) r = adaptor.Cylinder().Radius();
  else if (t === S.GeomAbs_Sphere) r = adaptor.Sphere().Radius();
  adaptor.delete?.();
  return r;
}

/** Unit tangent of a line edge; undefined for curved edges. */
function edgeTangent(ctx: WorkerContext, edge: TopoDS_Shape): Vec3 | undefined {
  const { oc } = ctx;
  const adaptor = new oc.BRepAdaptor_Curve_2(edge);
  let dir: Vec3 | undefined;
  if (adaptor.GetType() === oc.GeomAbs_CurveType.GeomAbs_Line) {
    dir = normalize(toVec(adaptor.Line().Direction()));
  }
  adaptor.delete?.();
  return dir;
}

/** Radius of a circular edge; undefined otherwise. */
function edgeRadius(ctx: WorkerContext, edge: TopoDS_Shape): number | undefined {
  const { oc } = ctx;
  const adaptor = new oc.BRepAdaptor_Curve_2(edge);
  let r: number | undefined;
  if (adaptor.GetType() === oc.GeomAbs_CurveType.GeomAbs_Circle) r = adaptor.Circle().Radius();
  adaptor.delete?.();
  return r;
}

/**
 * Describe every sub-shape of `shape` of the given kind, in ordinal-index order,
 * as a {@link SubShapeDescriptor} ready for `evaluate`/`selectSubShapes`.
 */
export function describeSubShapes(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  kind: SubShapeKind
): SubShapeDescriptor[] {
  return mapSubShapes(ctx, shape, kind).map((sub, i) => {
    const fp = computeFingerprint(ctx, sub, kind, i);
    const base: SubShapeDescriptor = {
      index: i,
      kind,
      geomType: fp.geomType,
      measure: fp.measure,
      centroid: fp.centroid,
      obb: fp.obb,
    };
    if (kind === SubShapeKind.Vertex) return base;

    const direction = kind === SubShapeKind.Face ? faceNormal(ctx, sub) : edgeTangent(ctx, sub);
    const radius = kind === SubShapeKind.Face ? faceRadius(ctx, sub) : edgeRadius(ctx, sub);
    if (direction) base.direction = direction;
    if (radius !== undefined) base.radius = radius;
    return base;
  });
}
