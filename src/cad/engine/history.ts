/**
 * Exact sub-shape tracking through OpenCascade operation history.
 *
 * Fingerprints (`fingerprint.ts`) re-find a selection by *geometry* after a
 * rebuild renumbers the index map — robust, but heuristic: it can be ambiguous
 * between two near-identical faces, and it cannot tell a face that was *split*
 * by a boolean from one that merely moved. OCC history gives the *exact* answer:
 * every `BRepBuilderAPI_MakeShape` (prism, fillet, chamfer, thick-solid) and
 * every `BRepAlgoAPI_*` boolean (with `SetToFillHistory(true)`) records, per
 * input sub-shape, the sub-shapes it was `Modified` into, `Generated`, or had
 * `IsRemoved`/`IsDeleted`.
 *
 * This module is the propagation primitive: follow a tagged sub-shape forward
 * through one operation (`followShape`), carry a whole set of id-tagged
 * sub-shapes across an operation (`carryThroughHistory`), and accumulate a
 * cumulative history across a rebuild's chain of booleans (`mergeInto`). The
 * intended wiring is that stable IDs ride history exactly, with the fingerprint
 * demoted to the fallback used only where history is unavailable (e.g. the first
 * build, or sketch external geometry).
 *
 * Pure with respect to OCC: every kernel call goes through `ctx.oc`, so it is
 * exercised in unit tests with a faithful mock (no WASM). Real geometric
 * correctness of the propagation is covered by the e2e suite
 * (`e2e/modifications.spec.ts`, real kernel).
 */

type TopoDS_Shape = any;
import type { WorkerContext } from './workerContext';

/** Outcome of following one sub-shape forward through an operation. */
export enum TrackStatus {
  Unchanged = 'unchanged',
  Modified = 'modified',
  Generated = 'generated',
  Removed = 'removed',
}

export interface FollowResult {
  status: TrackStatus;
  /** Descendant sub-shape(s) in the operation's output. Empty when removed. */
  shapes: TopoDS_Shape[];
}

/** An id-tagged live sub-shape carried through a chain of operations. */
export interface TrackedRef {
  /** Stable id (e.g. the originating `edge-N` / `face-N` or a persistent id). */
  id: string;
  /** The current live OCC sub-shape this id resolves to. */
  shape: TopoDS_Shape;
}

/**
 * Uniform view over OCC's two history sources. Booleans expose history via a
 * `History()` `BRepTools_History` (which reports removal as `IsRemoved`); the
 * `MakeShape` family answers `Modified`/`Generated`/`IsDeleted` directly. Both
 * are adapted to this single shape so the propagation logic is source-agnostic.
 */
export interface ShapeHistory {
  modified(sub: TopoDS_Shape): TopoDS_Shape[];
  generated(sub: TopoDS_Shape): TopoDS_Shape[];
  isRemoved(sub: TopoDS_Shape): boolean;
}

/** Walk an OCC `TopTools_ListOfShape` into a JS array via its list iterator. */
function listToArray(ctx: WorkerContext, list: any): TopoDS_Shape[] {
  const { oc } = ctx;
  const out: TopoDS_Shape[] = [];
  const it = new oc.TopTools_ListIteratorOfListOfShape_2(list);
  while (it.More()) {
    out.push(it.Value());
    it.Next();
  }
  it.delete?.();
  return out;
}

/**
 * Adapt a boolean's `History()` return to {@link ShapeHistory}. Accepts either
 * the OCC `Handle_BRepTools_History` (unwrapped via `.get()`) or a bare
 * `BRepTools_History`.
 */
export function fromBuilderHistory(historyOrHandle: any): ShapeHistory {
  const h = typeof historyOrHandle?.get === 'function' ? historyOrHandle.get() : historyOrHandle;
  return {
    modified: (sub) => h.Modified(sub),
    generated: (sub) => h.Generated(sub),
    isRemoved: (sub) => h.IsRemoved(sub),
  };
  // NOTE: lists are unwrapped lazily by followShape so a ctx is in scope there.
}

/**
 * Adapt a `BRepBuilderAPI_MakeShape` maker (prism, fillet, chamfer, thick-solid)
 * to {@link ShapeHistory}. The maker reports removal as `IsDeleted`.
 */
export function fromMaker(maker: any): ShapeHistory {
  return {
    modified: (sub) => maker.Modified(sub),
    generated: (sub) => maker.Generated(sub),
    isRemoved: (sub) => maker.IsDeleted(sub),
  };
}

/**
 * Follow one sub-shape forward through an operation. Precedence mirrors OCC
 * semantics: a removed shape is terminal (no descendants); otherwise a non-empty
 * `Modified` list wins (the shape was transformed/split), else a non-empty
 * `Generated` list (new shapes spawned from it), else it passed through
 * unchanged and is carried as itself.
 */
export function followShape(
  ctx: WorkerContext,
  history: ShapeHistory,
  sub: TopoDS_Shape
): FollowResult {
  if (history.isRemoved(sub)) return { status: TrackStatus.Removed, shapes: [] };
  const modified = listToArray(ctx, history.modified(sub));
  if (modified.length > 0) return { status: TrackStatus.Modified, shapes: modified };
  const generated = listToArray(ctx, history.generated(sub));
  if (generated.length > 0) return { status: TrackStatus.Generated, shapes: generated };
  return { status: TrackStatus.Unchanged, shapes: [sub] };
}

/**
 * Carry a set of id-tagged sub-shapes across one operation. A removed shape is
 * dropped; a modified/split shape replaces its tracked entry with one entry per
 * descendant (the id rides along to all of them); an untouched shape is carried
 * as-is. Apply this once per operation in build order to thread IDs through a
 * rebuild's whole chain of booleans and modifications.
 */
export function carryThroughHistory(
  ctx: WorkerContext,
  history: ShapeHistory,
  tracked: TrackedRef[]
): TrackedRef[] {
  const out: TrackedRef[] = [];
  for (const t of tracked) {
    const { status, shapes } = followShape(ctx, history, t.shape);
    if (status === TrackStatus.Removed) continue;
    for (const shape of shapes) out.push({ id: t.id, shape });
  }
  return out;
}

/**
 * Turn on history filling for a boolean builder. Must be called *before* the
 * operation is built — `BRepAlgoAPI_*` only records history when this flag is set
 * ahead of `Build()`. (The `MakeShape` family fills history unconditionally.)
 */
export function enableHistory(builder: any): void {
  builder.SetToFillHistory(true);
}

/** Create an empty cumulative history to fold per-operation histories into. */
export function newCumulativeHistory(ctx: WorkerContext): any {
  return new ctx.oc.BRepTools_History_1();
}

/**
 * Fold one operation's history into the cumulative history (OCC `Merge_1`) so a
 * query against an *original* sub-shape returns its descendant in the *final*
 * shape — letting a selection captured before a chain of edits resolve against
 * the rebuilt body in one lookup.
 */
export function mergeInto(cumulative: any, operationHistory: any): void {
  cumulative.Merge_1(operationHistory);
}
