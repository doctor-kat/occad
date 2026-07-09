/**
 * Geometric fingerprinting for stable face/edge identity.
 *
 * The topological-naming problem: selections are stored as ordinal indices
 * (`edge-N` / `face-N`) into an OCC `TopTools_IndexedMapOfShape`. Those indices
 * renumber whenever the body topology changes (every boolean rebuilds the whole
 * shape), so a stored `edge-7` can silently bind to a *different* edge.
 *
 * A fingerprint anchors a sub-shape to its *geometry* instead of its position:
 * surface/curve type + measure (area/length) + centroid + oriented-bounding-box
 * size signature. After an edit that renumbers indices, we recompute fingerprints
 * for the live body and match the stored one back to whichever sub-shape it now
 * is — by geometry, not by index. The ordinal index is retained only as a
 * fallback / migration aid.
 *
 * This module is pure with respect to OCC: every kernel call goes through
 * `ctx.oc`, so it is exercised in unit tests with a faithful mock (no WASM).
 */

type TopoDS_Shape = any;
import type { WorkerContext } from './workerContext';
import type { Fingerprint, StableRef } from '@/cad/types';
import { SubShapeKind } from '@/cad/types';

// Re-export the shared serializable types so existing importers of
// `./fingerprint` keep working; the canonical definitions live in
// `src/cad/types/geometry/Fingerprint.ts`.
export type { Fingerprint, StableRef } from '@/cad/types';
export { SubShapeKind } from '@/cad/types';

/** Combined-score acceptance threshold (dimensionless; ~fraction of size). */
export const ACCEPT_THRESHOLD = 0.08;
/** If the two best candidates are within this margin, the match is ambiguous. */
export const AMBIGUITY_MARGIN = 0.02;

// ---- OCC extraction (all via ctx.oc so it can be mocked) -------------------

/** The OCC `TopAbs_ShapeEnum` for a sub-shape kind. */
function shapeEnumFor(ctx: WorkerContext, kind: SubShapeKind): any {
  const e = ctx.oc.TopAbs_ShapeEnum;
  return kind === SubShapeKind.Edge ? e.TopAbs_EDGE : kind === SubShapeKind.Face ? e.TopAbs_FACE : e.TopAbs_VERTEX;
}

/** Cast a raw sub-shape to its concrete OCC type for the given kind. */
function castSubShape(ctx: WorkerContext, sub: TopoDS_Shape, kind: SubShapeKind): TopoDS_Shape {
  const { oc } = ctx;
  return kind === SubShapeKind.Edge
    ? oc.TopoDS.Edge_1(sub)
    : kind === SubShapeKind.Face
      ? oc.TopoDS.Face_1(sub)
      : oc.TopoDS.Vertex_1(sub);
}

/** Flatten the 1-based OCC sub-shape map to a 0-based array of sub-shapes. */
export function mapSubShapes(ctx: WorkerContext, shape: TopoDS_Shape, kind: SubShapeKind): TopoDS_Shape[] {
  const { oc } = ctx;
  const map = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, shapeEnumFor(ctx, kind), map);
  const out: TopoDS_Shape[] = [];
  for (let i = 1; i <= map.Extent(); i++) {
    out.push(castSubShape(ctx, map.FindKey(i), kind));
  }
  map.delete();
  return out;
}

/** Geometric type tag for a face. */
function faceGeomType(ctx: WorkerContext, face: TopoDS_Shape): string {
  const { oc } = ctx;
  const adaptor = new oc.BRepAdaptor_Surface_2(face, true);
  const t = adaptor.GetType();
  const S = oc.GeomAbs_SurfaceType;
  const table: [unknown, string][] = [
    [S.GeomAbs_Plane, 'plane'],
    [S.GeomAbs_Cylinder, 'cylinder'],
    [S.GeomAbs_Cone, 'cone'],
    [S.GeomAbs_Sphere, 'sphere'],
    [S.GeomAbs_Torus, 'torus'],
    [S.GeomAbs_BSplineSurface, 'bspline'],
  ];
  let name = 'other';
  for (const [val, n] of table) if (t === val) { name = n; break; }
  adaptor.delete?.();
  return name;
}

/** Geometric type tag for an edge. */
function edgeGeomType(ctx: WorkerContext, edge: TopoDS_Shape): string {
  const { oc } = ctx;
  const adaptor = new oc.BRepAdaptor_Curve_2(edge);
  const t = adaptor.GetType();
  const C = oc.GeomAbs_CurveType;
  const table: [unknown, string][] = [
    [C.GeomAbs_Line, 'line'],
    [C.GeomAbs_Circle, 'circle'],
    [C.GeomAbs_Ellipse, 'ellipse'],
    [C.GeomAbs_BSplineCurve, 'bspline'],
  ];
  let name = 'other';
  for (const [val, n] of table) if (t === val) { name = n; break; }
  adaptor.delete?.();
  return name;
}

/** Mass (area/length) + center of mass for a sub-shape. */
function massAndCentroid(
  ctx: WorkerContext,
  sub: TopoDS_Shape,
  kind: SubShapeKind
): { measure: number; centroid: { x: number; y: number; z: number } } {
  const { oc } = ctx;
  const props = new oc.GProp_GProps_1();
  if (kind === SubShapeKind.Face) oc.BRepGProp.SurfaceProperties_1(sub, props, false, false);
  else oc.BRepGProp.LinearProperties(sub, props, false, false);
  const measure = props.Mass();
  const com = props.CentreOfMass();
  const centroid = { x: com.X(), y: com.Y(), z: com.Z() };
  com.delete?.();
  props.delete?.();
  return { measure, centroid };
}

/** Oriented bounding-box half-sizes, sorted ascending. */
function obbHalfSizes(ctx: WorkerContext, sub: TopoDS_Shape): [number, number, number] {
  const { oc } = ctx;
  const obb = new oc.Bnd_OBB_1();
  oc.BRepBndLib.AddOBB(sub, obb, false, true, false);
  const sizes: [number, number, number] = [obb.XHSize(), obb.YHSize(), obb.ZHSize()];
  obb.delete?.();
  sizes.sort((a, b) => a - b);
  return sizes;
}

/**
 * Location of a vertex sub-shape. A vertex has no area/length or extent, so its
 * fingerprint is just its world point (measure 0, zero OBB) — matching then
 * reduces to point coincidence, which is exactly the right identity for a
 * geometry-anchored vertex selection.
 */
function vertexPoint(ctx: WorkerContext, vertex: TopoDS_Shape): { x: number; y: number; z: number } {
  const { oc } = ctx;
  const pnt = oc.BRep_Tool.Pnt(vertex);
  const point = { x: pnt.X(), y: pnt.Y(), z: pnt.Z() };
  pnt.delete?.();
  return point;
}

/** Compute a fingerprint for one sub-shape at a known ordinal index. */
export function computeFingerprint(
  ctx: WorkerContext,
  sub: TopoDS_Shape,
  kind: SubShapeKind,
  index: number
): Fingerprint {
  if (kind === SubShapeKind.Vertex) {
    return { kind, index, geomType: 'point', measure: 0, centroid: vertexPoint(ctx, sub), obb: [0, 0, 0] };
  }
  const geomType = kind === SubShapeKind.Face ? faceGeomType(ctx, sub) : edgeGeomType(ctx, sub);
  const { measure, centroid } = massAndCentroid(ctx, sub, kind);
  const obb = obbHalfSizes(ctx, sub);
  return { kind, index, geomType, measure, centroid, obb };
}

/** Fingerprint every face (or edge) of a body, in ordinal-index order. */
export function fingerprintAll(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  kind: SubShapeKind
): Fingerprint[] {
  return mapSubShapes(ctx, shape, kind).map((sub, i) => computeFingerprint(ctx, sub, kind, i));
}

// ---- Matching --------------------------------------------------------------

function centroidDistance(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function relDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9);
}

function obbDiff(a: [number, number, number], b: [number, number, number]): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < 3; i++) {
    num += Math.abs(a[i] - b[i]);
    den += Math.abs(b[i]);
  }
  return num / Math.max(den, 1e-9);
}

/**
 * Dimensionless dissimilarity between two fingerprints. 0 = identical geometry,
 * larger = more different. A different kind or geomType is an instant `Infinity`
 * (no amount of size similarity should match a plane to a cylinder). The three
 * size/position terms are each normalized so the score is unit-independent.
 */
export function fingerprintScore(a: Fingerprint, b: Fingerprint): number {
  if (a.kind !== b.kind || a.geomType !== b.geomType) return Infinity;
  const characteristicLength = Math.max(b.obb[2], 1e-9);
  const dCentroid = centroidDistance(a.centroid, b.centroid) / characteristicLength;
  const dMeasure = relDiff(a.measure, b.measure);
  const dObb = obbDiff(a.obb, b.obb);
  return dCentroid + dMeasure + dObb;
}

export interface FingerprintMatch {
  /** Index of the best candidate, or -1 if none. */
  index: number;
  /** Score of the best candidate (Infinity if no kind/type-compatible candidate). */
  score: number;
  /** True when the best candidate is within threshold AND unambiguous. */
  confident: boolean;
  /** True when two candidates are both plausible and too close to tell apart. */
  ambiguous: boolean;
}

/**
 * Find the candidate fingerprint that best matches `target`. Returns the best
 * index plus confidence flags. A confident match means: best score within
 * ACCEPT_THRESHOLD and clearly better than the runner-up (so we never bind to
 * one of two near-identical faces by accident).
 */
export function matchFingerprint(target: Fingerprint, candidates: Fingerprint[]): FingerprintMatch {
  let best = -1;
  let bestScore = Infinity;
  let secondScore = Infinity;
  candidates.forEach((c, i) => {
    const s = fingerprintScore(target, c);
    if (s < bestScore) {
      secondScore = bestScore;
      bestScore = s;
      best = i;
    } else if (s < secondScore) {
      secondScore = s;
    }
  });

  const within = bestScore <= ACCEPT_THRESHOLD;
  const ambiguous =
    within && secondScore <= ACCEPT_THRESHOLD && secondScore - bestScore < AMBIGUITY_MARGIN;
  return { index: best, score: bestScore, confident: within && !ambiguous, ambiguous };
}

/**
 * Resolve a stable ref against a precomputed list of live fingerprints, returning
 * the live 0-based index (or -1). Prefers a confident fingerprint match (survives
 * index renumbering); falls back to the stored ordinal index if still in range.
 * Splitting out the precomputed-`live` form lets callers fingerprint the body
 * once and resolve many refs against it.
 */
export function resolveAgainst(live: Fingerprint[], ref: StableRef): number {
  if (ref.fingerprint) {
    const m = matchFingerprint(ref.fingerprint, live);
    if (m.confident) return m.index;
  }
  if (Number.isInteger(ref.index) && ref.index >= 0 && ref.index < live.length) return ref.index;
  return -1;
}

/**
 * Resolve a stable reference against the *current* body, returning the live
 * 0-based sub-shape index it now corresponds to (or -1 if it cannot be found).
 * The caller treats -1 as a stale selection and surfaces it (see modifications.ts).
 */
export function resolveStableRef(ctx: WorkerContext, shape: TopoDS_Shape, ref: StableRef): number {
  return resolveAgainst(fingerprintAll(ctx, shape, ref.kind), ref);
}
