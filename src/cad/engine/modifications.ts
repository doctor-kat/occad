/**
 * Modification Operations
 *
 * Engine handlers for the "Modifications" feature family: fillet, chamfer,
 * shell, and offset. Unlike sketch-based features and primitives, these do not
 * produce a standalone body that is then boolean-combined — they transform the
 * *current* body in place (selecting edges to round/bevel, or faces to remove /
 * offset). During a parametric rebuild they receive the accumulated body and
 * return the modified body, which becomes the new current body.
 *
 * Selection references use the same 0-based `edge-N` / `face-N` scheme produced
 * by `handleGetFaceGeometry` and the Entities panel; `resolveSubShapes` maps
 * them back to the OCC sub-shapes of the body being modified.
 */

type TopoDS_Shape = any;
import type { WorkerContext } from './workerContext';
import type { FilletParams, ChamferParams, ShellParams, OffsetParams, GeometryRef, Fingerprint, StableRef } from '@/cad/types';
import { toStableRef, refLabel, hasFingerprint } from '@/cad/types';
import { fingerprintAll, matchFingerprint, resolveAgainst } from './fingerprint';

/** Tolerance used by the offset/thick-solid join builders. */
const OFFSET_TOL = 1e-3;

/**
 * Parse the trailing integer from a geometry reference such as `edge-3` or
 * `face-0`. Returns NaN when the ref has no numeric suffix.
 */
export function parseGeometryIndex(ref: string): number {
  const suffix = ref.slice(ref.lastIndexOf('-') + 1);
  if (suffix === '' || !/^\d+$/.test(suffix)) return NaN;
  return Number(suffix);
}

/** Result of resolving geometry references against a body. */
export interface ResolvedSubShapes {
  /** The OCC sub-shapes that resolved successfully. */
  shapes: TopoDS_Shape[];
  /**
   * References that did NOT resolve (malformed, or out of range because the
   * body topology changed since selection). Callers must treat a non-empty
   * `unresolved` as an error rather than silently proceeding — an in-range but
   * shifted index would otherwise bind to the *wrong* sub-shape.
   */
  unresolved: string[];
}

/**
 * Resolve a list of geometry references to the corresponding OCC sub-shapes of
 * `shape`. A ref is either a legacy `edge-N` / `face-N` string or a fingerprinted
 * `StableRef`:
 *
 *  - A bare index resolves positionally (`FindKey(N + 1)`), exactly as before.
 *  - A ref carrying a fingerprint is re-found by *geometry* — so it survives an
 *    upstream edit that renumbered the index map — and only falls back to the
 *    stored ordinal index if no confident geometric match exists.
 *
 * Malformed / out-of-range / unmatched refs are collected into `unresolved`
 * (never silently dropped) so the caller fails loudly and the stale selection
 * surfaces on the feature. The body is only fingerprinted when some ref actually
 * carries a fingerprint, so the common index-only path stays cheap.
 */
export function resolveSubShapes(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  refs: GeometryRef[],
  kind: 'edge' | 'face'
): ResolvedSubShapes {
  const { oc } = ctx;
  const shapeEnum =
    kind === 'edge' ? oc.TopAbs_ShapeEnum.TopAbs_EDGE : oc.TopAbs_ShapeEnum.TopAbs_FACE;
  const map = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, shapeEnum, map);
  const extent = map.Extent();

  // Lazily fingerprint the live body — only when a ref needs it (keeps the
  // index-only path from touching GProp/OBB at all).
  let live: Fingerprint[] | null = null;
  const liveFingerprints = (): Fingerprint[] => (live ??= fingerprintAll(ctx, shape, kind));

  const inRange = (idx: number) => Number.isInteger(idx) && idx >= 0 && idx < extent;

  const shapes: TopoDS_Shape[] = [];
  const unresolved: string[] = [];
  for (const ref of refs) {
    const stable = toStableRef(ref);
    if (!stable || stable.kind !== kind) {
      unresolved.push(refLabel(ref));
      continue;
    }

    let idx = -1;
    if (stable.fingerprint) {
      const m = matchFingerprint(stable.fingerprint, liveFingerprints());
      idx = m.confident ? m.index : inRange(stable.index) ? stable.index : -1;
    } else {
      idx = inRange(stable.index) ? stable.index : -1;
    }

    if (!inRange(idx)) {
      unresolved.push(refLabel(ref));
      continue;
    }
    const sub = map.FindKey(idx + 1);
    shapes.push(kind === 'edge' ? oc.TopoDS.Edge_1(sub) : oc.TopoDS.Face_1(sub));
  }

  map.delete();
  return { shapes, unresolved };
}

/**
 * Lazily upgrade bare-index refs to fingerprinted StableRefs against `body`.
 *
 * Called during rebuild with the body a modification is about to act on (where
 * the stored indices are still valid). For each ref lacking a fingerprint, we
 * resolve it to a live sub-shape and attach that sub-shape's fingerprint, so
 * every later rebuild can re-find the selection by geometry even after the index
 * map renumbers. Refs that already have a fingerprint are kept as-is (the
 * original selection geometry is authoritative); malformed / unresolved refs are
 * left untouched so the apply step still fails loudly on them.
 *
 * Returns the upgraded array, or `null` when nothing changed (so the caller can
 * skip the write-back and the capture converges after one rebuild).
 */
export function enrichRefs(
  ctx: WorkerContext,
  body: TopoDS_Shape,
  refs: GeometryRef[],
  kind: 'edge' | 'face'
): GeometryRef[] | null {
  if (!refs?.length || refs.every(hasFingerprint)) return null;

  const live = fingerprintAll(ctx, body, kind);
  let changed = false;
  const out = refs.map((ref) => {
    if (hasFingerprint(ref)) return ref;
    const stable = toStableRef(ref);
    if (!stable || stable.kind !== kind) return ref; // malformed -> leave for loud error
    const idx = resolveAgainst(live, stable);
    if (idx < 0) return ref; // unresolved -> leave for loud error
    changed = true;
    return { kind, index: idx, fingerprint: live[idx] } as StableRef;
  });
  return changed ? out : null;
}

/**
 * Round the selected edges of `shape` with a constant radius.
 * OCC: `BRepFilletAPI_MakeFillet`.
 */
export function applyFillet(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: FilletParams
): TopoDS_Shape {
  const { oc } = ctx;
  if (!params.edges?.length) throw new Error('Fillet requires at least one edge');
  if (!(params.radius > 0)) throw new Error('Fillet radius must be positive');

  const { shapes: edges, unresolved } = resolveSubShapes(ctx, shape, params.edges, 'edge');
  if (unresolved.length > 0) {
    throw new Error(
      `Fillet: could not resolve edge selection(s) [${unresolved.join(', ')}] — the model topology may have changed since these edges were selected.`
    );
  }
  if (edges.length === 0) throw new Error('Fillet: none of the selected edges could be resolved');

  const maker = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
  for (const edge of edges) maker.Add_2(params.radius, edge);

  const progress = new oc.Message_ProgressRange_1();
  maker.Build(progress);
  const done = maker.IsDone();
  if (!done) {
    maker.delete();
    progress.delete();
    throw new Error('Fillet failed (BRepFilletAPI_MakeFillet not done)');
  }
  const result = maker.Shape();
  maker.delete();
  progress.delete();
  return result;
}

/**
 * Bevel the selected edges of `shape` with a symmetric distance.
 * OCC: `BRepFilletAPI_MakeChamfer`.
 */
export function applyChamfer(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: ChamferParams
): TopoDS_Shape {
  const { oc } = ctx;
  if (!params.edges?.length) throw new Error('Chamfer requires at least one edge');
  if (!(params.distance > 0)) throw new Error('Chamfer distance must be positive');

  const { shapes: edges, unresolved } = resolveSubShapes(ctx, shape, params.edges, 'edge');
  if (unresolved.length > 0) {
    throw new Error(
      `Chamfer: could not resolve edge selection(s) [${unresolved.join(', ')}] — the model topology may have changed since these edges were selected.`
    );
  }
  if (edges.length === 0) throw new Error('Chamfer: none of the selected edges could be resolved');

  const maker = new oc.BRepFilletAPI_MakeChamfer(shape);
  for (const edge of edges) maker.Add_2(params.distance, edge);

  const progress = new oc.Message_ProgressRange_1();
  maker.Build(progress);
  const done = maker.IsDone();
  if (!done) {
    maker.delete();
    progress.delete();
    throw new Error('Chamfer failed (BRepFilletAPI_MakeChamfer not done)');
  }
  const result = maker.Shape();
  maker.delete();
  progress.delete();
  return result;
}

/**
 * Hollow out `shape`, removing the selected faces and leaving a wall of the
 * given thickness (negative = inward). OCC: `BRepOffsetAPI_MakeThickSolid`.
 */
export function applyShell(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: ShellParams
): TopoDS_Shape {
  const { oc } = ctx;
  if (!params.faces?.length) throw new Error('Shell requires at least one face to remove');
  if (!params.thickness) throw new Error('Shell thickness must be non-zero');

  const { shapes: faces, unresolved } = resolveSubShapes(ctx, shape, params.faces, 'face');
  if (unresolved.length > 0) {
    throw new Error(
      `Shell: could not resolve face selection(s) [${unresolved.join(', ')}] — the model topology may have changed since these faces were selected.`
    );
  }
  if (faces.length === 0) throw new Error('Shell: none of the selected faces could be resolved');

  const closingFaces = new oc.TopTools_ListOfShape_1();
  for (const face of faces) closingFaces.Append_1(face);

  const maker = new oc.BRepOffsetAPI_MakeThickSolid();
  const progress = new oc.Message_ProgressRange_1();
  maker.MakeThickSolidByJoin(
    shape,
    closingFaces,
    params.thickness,
    OFFSET_TOL,
    oc.BRepOffset_Mode.BRepOffset_Skin,
    false,
    false,
    oc.GeomAbs_JoinType.GeomAbs_Arc,
    false,
    progress
  );
  const done = maker.IsDone();
  if (!done) {
    maker.delete();
    progress.delete();
    closingFaces.delete();
    throw new Error('Shell failed (BRepOffsetAPI_MakeThickSolid not done)');
  }
  const result = maker.Shape();
  maker.delete();
  progress.delete();
  closingFaces.delete();
  return result;
}

/**
 * Offset the whole body outward (positive) or inward (negative) by a distance.
 * OCC: `BRepOffsetAPI_MakeOffsetShape`.
 */
export function applyOffset(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: OffsetParams
): TopoDS_Shape {
  const { oc } = ctx;
  if (!params.distance) throw new Error('Offset distance must be non-zero');

  const maker = new oc.BRepOffsetAPI_MakeOffsetShape();
  const progress = new oc.Message_ProgressRange_1();
  maker.PerformByJoin(
    shape,
    params.distance,
    OFFSET_TOL,
    oc.BRepOffset_Mode.BRepOffset_Skin,
    false,
    false,
    oc.GeomAbs_JoinType.GeomAbs_Arc,
    false,
    progress
  );
  const done = maker.IsDone();
  if (!done) {
    maker.delete();
    progress.delete();
    throw new Error('Offset failed (BRepOffsetAPI_MakeOffsetShape not done)');
  }
  const result = maker.Shape();
  maker.delete();
  progress.delete();
  return result;
}
