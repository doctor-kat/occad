import { describe, it, expect } from "vitest";
import { applySweep, applyLoft } from "./advancedModeling";
import type { WorkerContext } from "./workerContext";

/**
 * Fake OpenCascade context for exercising sweep/loft control flow without the
 * WASM kernel (loaded only in the browser). As with `modifications.test.ts` /
 * `operations.test.ts`, geometric validity is covered by the e2e suite; here we
 * verify that each op drives the expected OCC maker and propagates failure.
 *
 * Shapes are tagged with a `__kind` so `ensureFace`/`ensureWire` route them.
 */
const WIRE = "WIRE";
const FACE = "FACE";
const EDGE = "EDGE";
const COMPOUND = "COMPOUND";

function mockCtx(recorder: any = {}): WorkerContext {
  const oc: any = {
    TopAbs_ShapeEnum: {
      TopAbs_WIRE: WIRE,
      TopAbs_FACE: FACE,
      TopAbs_EDGE: EDGE,
      TopAbs_COMPOUND: COMPOUND,
    },
    TopoDS: {
      Wire_1: (s: any) => ({ ...s, __as: "wire" }),
      Face_1: (s: any) => ({ ...s, __as: "face" }),
      Edge_1: (s: any) => ({ ...s, __as: "edge" }),
    },
    BRepTools: {
      OuterWire: (face: any) => ({ __kind: WIRE, from: face }),
    },
    BRepBuilderAPI_MakeWire_2: class {
      constructor(edge: any) { recorder.wireFromEdge = edge; }
      Wire() { return { __kind: WIRE, wrapped: true }; }
      delete() {}
    },
    BRepBuilderAPI_MakeFace_15: class {
      constructor(public wire: any) {}
      IsDone() { return true; }
      Face() { return { __kind: FACE, fromWire: this.wire }; }
      delete() {}
    },
    Message_ProgressRange_1: class { delete() {} },
    BRepOffsetAPI_MakePipe_1: class {
      constructor(spine: any, profile: any) {
        recorder.pipe = { spine, profile, built: false };
      }
      Build() { recorder.pipe.built = true; }
      IsDone() { return recorder.pipeDone ?? true; }
      Shape() { return { __kind: "SOLID", swept: true }; }
      delete() {}
    },
    BRepOffsetAPI_ThruSections: class {
      wires: any[] = [];
      constructor(public isSolid: boolean, public ruled: boolean, public pres: number) {
        recorder.thru = this;
      }
      AddWire(w: any) { this.wires.push(w); }
      Build() { recorder.thru.built = true; }
      IsDone() { return recorder.thruDone ?? true; }
      Shape() { return { __kind: "SOLID", lofted: true, count: this.wires.length }; }
      delete() {}
    },
  };
  return { oc } as unknown as WorkerContext;
}

const face = () => ({ __kind: FACE, ShapeType: () => FACE });
const wire = () => ({ __kind: WIRE, ShapeType: () => WIRE });

describe("applySweep", () => {
  it("sweeps a profile face along a path wire and returns the pipe shape", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const result = applySweep(ctx, face(), wire());
    expect(rec.pipe.built).toBe(true);
    expect(rec.pipe.profile.__kind).toBe(FACE);
    expect(result).toMatchObject({ swept: true });
  });

  it("faces a wire profile before sweeping", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    applySweep(ctx, wire(), wire());
    // ensureFace converts the wire profile → a face for the pipe.
    expect(rec.pipe.profile.__kind).toBe(FACE);
  });

  it("throws when the pipe maker is not done", () => {
    const rec: any = { pipeDone: false };
    const ctx = mockCtx(rec);
    expect(() => applySweep(ctx, face(), wire())).toThrow(/Sweep failed/);
  });
});

describe("applyLoft", () => {
  it("lofts through the given profiles (outer wires) and returns a solid", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const result = applyLoft(ctx, [face(), face(), face()]);
    expect(rec.thru.built).toBe(true);
    expect(rec.thru.wires).toHaveLength(3);
    expect(result).toMatchObject({ lofted: true, count: 3 });
  });

  it("passes the ruled flag through to the maker", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    applyLoft(ctx, [face(), face()], true);
    expect(rec.thru.ruled).toBe(true);
  });

  it("requires at least two profiles", () => {
    const ctx = mockCtx({});
    expect(() => applyLoft(ctx, [face()])).toThrow(/at least two/);
  });

  it("throws when the loft maker is not done", () => {
    const rec: any = { thruDone: false };
    const ctx = mockCtx(rec);
    expect(() => applyLoft(ctx, [face(), face()])).toThrow(/Loft failed/);
  });
});
