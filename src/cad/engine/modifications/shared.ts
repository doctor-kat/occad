/**
 * Shared helpers for the Modifications engine handlers (fillet, chamfer,
 * shell, offset). See `index.ts` for the family overview.
 */

type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import type { GeometryRef, Fingerprint, StableRef } from '@/cad/types';
import { toStableRef, refLabel, hasFingerprint, SubShapeKind } from '@/cad/types';
import { fingerprintAll, matchFingerprint, resolveAgainst } from '../fingerprint';
import { describeSubShapes } from '../selectors/describe';
import { selectSubShapes } from '../selectors';

/**
 * Re-evaluate a persistent selector rule (ROADMAP §9.1 Phase 4) against the
 * live body and union the matches with the explicit `refs`, deduped by label.
 * Selector-matched indices resolve positionally against *this* body (they were
 * just computed from it), so they're passed through as plain `edge-N`/`face-N`
 * strings — `resolveSubShapes` still re-fingerprints/upgrades them next rebuild
 * like any other bare-index ref.
 */
export function withSelectorMatches(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  refs: GeometryRef[],
  kind: SubShapeKind.Edge | SubShapeKind.Face,
  selector: string | undefined
): GeometryRef[] {
  if (!selector?.trim()) return refs;
  const descriptors = describeSubShapes(ctx, shape, kind);
  const matched = selectSubShapes(descriptors, selector).map((index) => `${kind}-${index}`);
  const seen = new Set(refs.map(refLabel));
  const extra = matched.filter((label) => !seen.has(label));
  return [...refs, ...extra];
}

/** Tolerance used by the offset/thick-solid join builders. */
export const OFFSET_TOL = 1e-3;

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
  kind: SubShapeKind.Edge | SubShapeKind.Face
): ResolvedSubShapes {
  const { oc } = ctx;
  const shapeEnum =
    kind === SubShapeKind.Edge ? oc.TopAbs_ShapeEnum.TopAbs_EDGE : oc.TopAbs_ShapeEnum.TopAbs_FACE;
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
    shapes.push(kind === SubShapeKind.Edge ? oc.TopoDS.Edge_1(sub) : oc.TopoDS.Face_1(sub));
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
  kind: SubShapeKind.Edge | SubShapeKind.Face
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
