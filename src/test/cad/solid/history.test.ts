import { describe, it, expect } from "vitest";
import {
  followShape,
  carryThroughHistory,
  fromBuilderHistory,
  fromMaker,
  enableHistory,
  newCumulativeHistory,
  mergeInto,
} from "@/cad/solid/history";
import type { TrackedRef } from "@/cad/solid/TrackedRef";

/**
 * Build a fake OpenCascade context exercising the OCC *history* surface without
 * the WASM kernel:
 *
 *  - `TopTools_ListIteratorOfListOfShape_2` walks a `{ __items }` list, mirroring
 *    the OCC iterator (`More`/`Value`/`Next`).
 *  - `BRepTools_History_1` is the cumulative-history accumulator (`Merge_1`).
 *
 * The real geometric correctness of history propagation through a boolean is
 * e2e-only (`e2e/modifications.spec.ts`, real kernel). Here we pin the pure
 * bookkeeping: list extraction, the modified→generated→unchanged precedence,
 * removal dropping, id-carrying across an op, and the builder/maker adapters.
 */
function listOf(items: any[]) {
  return { __items: items };
}

function mockCtx() {
  const oc: any = {
    TopTools_ListIteratorOfListOfShape_2: class {
      _items: any[];
      _i = 0;
      constructor(list: any) {
        this._items = list?.__items ?? [];
      }
      More() {
        return this._i < this._items.length;
      }
      Value() {
        return this._items[this._i];
      }
      Next() {
        this._i++;
      }
      delete() {}
    },
    BRepTools_History_1: class {
      merged: any[] = [];
      Merge_1(other: any) {
        this.merged.push(other);
      }
      delete() {}
    },
  };
  return { oc } as any;
}

/** Spec describing how one operation transformed a set of sub-shapes. */
interface HistorySpec {
  removed?: any[];
  modified?: Map<any, any[]>;
  generated?: Map<any, any[]>;
}

/** A boolean op's `History()` return: a Handle wrapping a BRepTools_History. */
function builderHistoryHandle(spec: HistorySpec) {
  const h = {
    Modified: (s: any) => listOf(spec.modified?.get(s) ?? []),
    Generated: (s: any) => listOf(spec.generated?.get(s) ?? []),
    IsRemoved: (s: any) => (spec.removed ?? []).includes(s),
  };
  return { get: () => h };
}

/** A BRepBuilderAPI_MakeShape-style maker (uses `IsDeleted`, not `IsRemoved`). */
function makerMock(spec: HistorySpec) {
  return {
    Modified: (s: any) => listOf(spec.modified?.get(s) ?? []),
    Generated: (s: any) => listOf(spec.generated?.get(s) ?? []),
    IsDeleted: (s: any) => (spec.removed ?? []).includes(s),
  };
}

const A = { id: "A" };
const B = { id: "B" };
const A1 = { id: "A1" };
const A2 = { id: "A2" };
const Bgen = { id: "Bgen" };

describe("followShape", () => {
  it("carries an untouched sub-shape as itself (status 'unchanged')", () => {
    const ctx = mockCtx();
    const hist = fromMaker(makerMock({}));
    expect(followShape(ctx, hist, A)).toEqual({ status: "unchanged", shapes: [A] });
  });

  it("reports a removed sub-shape with no descendants", () => {
    const ctx = mockCtx();
    const hist = fromMaker(makerMock({ removed: [A] }));
    expect(followShape(ctx, hist, A)).toEqual({ status: "removed", shapes: [] });
  });

  it("follows a modified sub-shape to its descendant(s)", () => {
    const ctx = mockCtx();
    const hist = fromMaker(makerMock({ modified: new Map([[A, [A1, A2]]]) }));
    expect(followShape(ctx, hist, A)).toEqual({ status: "modified", shapes: [A1, A2] });
  });

  it("follows a generated sub-shape when there is no modification", () => {
    const ctx = mockCtx();
    const hist = fromMaker(makerMock({ generated: new Map([[B, [Bgen]]]) }));
    expect(followShape(ctx, hist, B)).toEqual({ status: "generated", shapes: [Bgen] });
  });

  it("prefers Modified over Generated when both are present", () => {
    const ctx = mockCtx();
    const hist = fromMaker(
      makerMock({ modified: new Map([[A, [A1]]]), generated: new Map([[A, [A2]]]) })
    );
    expect(followShape(ctx, hist, A)).toEqual({ status: "modified", shapes: [A1] });
  });

  it("treats removal as terminal even if a stale modified entry exists", () => {
    const ctx = mockCtx();
    const hist = fromMaker(makerMock({ removed: [A], modified: new Map([[A, [A1]]]) }));
    expect(followShape(ctx, hist, A)).toEqual({ status: "removed", shapes: [] });
  });
});

describe("fromBuilderHistory", () => {
  it("unwraps the OCC Handle (.get()) and adapts Modified/Generated/IsRemoved", () => {
    const ctx = mockCtx();
    const handle = builderHistoryHandle({ modified: new Map([[A, [A1]]]) });
    const hist = fromBuilderHistory(handle);
    expect(followShape(ctx, hist, A)).toEqual({ status: "modified", shapes: [A1] });
  });

  it("accepts a bare BRepTools_History (no Handle wrapper)", () => {
    const ctx = mockCtx();
    const bare = builderHistoryHandle({ removed: [A] }).get();
    const hist = fromBuilderHistory(bare);
    expect(followShape(ctx, hist, A).status).toBe("removed");
  });
});

describe("carryThroughHistory", () => {
  it("carries an id across an unchanged sub-shape", () => {
    const ctx = mockCtx();
    const hist = fromMaker(makerMock({}));
    const tracked: TrackedRef[] = [{ id: "edge-7", shape: A }];
    expect(carryThroughHistory(ctx, hist, tracked)).toEqual([{ id: "edge-7", shape: A }]);
  });

  it("drops a tracked sub-shape that the operation removed", () => {
    const ctx = mockCtx();
    const hist = fromMaker(makerMock({ removed: [A] }));
    expect(carryThroughHistory(ctx, hist, [{ id: "x", shape: A }])).toEqual([]);
  });

  it("splits one tracked id across every modified descendant", () => {
    const ctx = mockCtx();
    const hist = fromMaker(makerMock({ modified: new Map([[A, [A1, A2]]]) }));
    const out = carryThroughHistory(ctx, hist, [{ id: "face-3", shape: A }]);
    expect(out).toEqual([
      { id: "face-3", shape: A1 },
      { id: "face-3", shape: A2 },
    ]);
  });

  it("propagates a whole set, mixing unchanged / modified / removed", () => {
    const ctx = mockCtx();
    const hist = fromMaker(
      makerMock({ removed: [B], modified: new Map([[A, [A1]]]) })
    );
    const out = carryThroughHistory(ctx, hist, [
      { id: "a", shape: A },
      { id: "b", shape: B },
    ]);
    expect(out).toEqual([{ id: "a", shape: A1 }]);
  });

  it("returns an empty set for an empty input", () => {
    const ctx = mockCtx();
    expect(carryThroughHistory(ctx, fromMaker(makerMock({})), [])).toEqual([]);
  });

  it("composes across two sequential operations (id survives a chain)", () => {
    const ctx = mockCtx();
    const op1 = fromMaker(makerMock({ modified: new Map([[A, [A1]]]) }));
    const afterOp1 = carryThroughHistory(ctx, op1, [{ id: "keep", shape: A }]);
    const op2 = fromMaker(makerMock({ modified: new Map([[A1, [A2]]]) }));
    const afterOp2 = carryThroughHistory(ctx, op2, afterOp1);
    expect(afterOp2).toEqual([{ id: "keep", shape: A2 }]);
  });
});

describe("enableHistory", () => {
  it("turns on history filling on a boolean builder before Build", () => {
    let flag: boolean | undefined;
    const builder: any = {
      SetToFillHistory(v: boolean) {
        flag = v;
      },
    };
    enableHistory(builder);
    expect(flag).toBe(true);
  });
});

describe("cumulative history (Merge)", () => {
  it("newCumulativeHistory creates an empty BRepTools_History", () => {
    const ctx = mockCtx();
    const cum = newCumulativeHistory(ctx);
    expect(cum.merged).toEqual([]);
  });

  it("mergeInto folds an operation history into the cumulative one (OCC Merge_1)", () => {
    const ctx = mockCtx();
    const cum = newCumulativeHistory(ctx);
    const op1 = { tag: "op1" };
    const op2 = { tag: "op2" };
    mergeInto(cum, op1);
    mergeInto(cum, op2);
    expect(cum.merged).toEqual([op1, op2]);
  });
});
