import { describe, it, expect } from "vitest";
import {
  parseGeometryIndex,
  resolveSubShapes,
  applyFillet,
  applyChamfer,
  applyShell,
  applyOffset,
} from "./modifications";
import type { FilletParams, ChamferParams, ShellParams, OffsetParams } from "@/cad/types";

/**
 * Build a fake OpenCascade context for exercising the modification logic
 * without the WASM kernel. The real geometric validity of fillet/chamfer/
 * shell/offset is covered by the e2e suite (`e2e/modifications.spec.ts`);
 * here we verify selection resolution, parameter validation, and that each
 * operation drives the expected OCC calls.
 *
 * A `shape` is modelled as `{ __edges: any[], __faces: any[] }`. `MapShapes_1`
 * copies the matching sub-shape list into the indexed map.
 */
function mockCtx(recorder: any = {}) {
  const TopAbs_EDGE = "EDGE";
  const TopAbs_FACE = "FACE";

  const oc = {
    TopAbs_ShapeEnum: { TopAbs_EDGE, TopAbs_FACE },
    TopExp: {
      MapShapes_1: (shape: any, kind: any, map: any) => {
        map._items = kind === TopAbs_EDGE ? shape.__edges ?? [] : shape.__faces ?? [];
      },
    },
    TopTools_IndexedMapOfShape_1: class {
      _items: any[] = [];
      Extent() {
        return this._items.length;
      }
      FindKey(i: number) {
        return this._items[i - 1];
      }
      delete() {}
    },
    TopoDS: {
      Edge_1: (s: any) => ({ edge: s }),
      Face_1: (s: any) => ({ face: s }),
    },
    ChFi3d_FilletShape: { ChFi3d_Rational: "rational" },
    BRepOffset_Mode: { BRepOffset_Skin: "skin" },
    GeomAbs_JoinType: { GeomAbs_Arc: "arc" },
    Message_ProgressRange_1: class {
      delete() {}
    },
    TopTools_ListOfShape_1: class {
      items: any[] = [];
      Append_1(s: any) {
        this.items.push(s);
      }
      delete() {}
    },
    BRepFilletAPI_MakeFillet: class {
      constructor(shape: any, fshape: any) {
        recorder.fillet = { shape, fshape, adds: [], built: false };
      }
      Add_2(radius: number, edge: any) {
        recorder.fillet.adds.push({ radius, edge });
      }
      Build() {
        recorder.fillet.built = true;
      }
      IsDone() {
        return recorder.filletDone ?? true;
      }
      Shape() {
        return { filleted: true };
      }
      delete() {}
    },
    BRepFilletAPI_MakeChamfer: class {
      constructor(shape: any) {
        recorder.chamfer = { shape, adds: [], built: false };
      }
      Add_2(distance: number, edge: any) {
        recorder.chamfer.adds.push({ distance, edge });
      }
      Build() {
        recorder.chamfer.built = true;
      }
      IsDone() {
        return recorder.chamferDone ?? true;
      }
      Shape() {
        return { chamfered: true };
      }
      delete() {}
    },
    BRepOffsetAPI_MakeThickSolid: class {
      constructor() {
        recorder.shell = { joinArgs: null };
      }
      MakeThickSolidByJoin(...args: any[]) {
        recorder.shell.joinArgs = args;
      }
      Build() {
        recorder.shell.built = true;
      }
      IsDone() {
        return recorder.shellDone ?? true;
      }
      Shape() {
        return { shelled: true };
      }
      delete() {}
    },
    BRepOffsetAPI_MakeOffsetShape: class {
      constructor() {
        recorder.offset = { joinArgs: null };
      }
      PerformByJoin(...args: any[]) {
        recorder.offset.joinArgs = args;
      }
      IsDone() {
        return recorder.offsetDone ?? true;
      }
      Shape() {
        return { offset: true };
      }
      delete() {}
    },
  };
  return { oc } as any;
}

/** A box-like shape: 12 edges, 6 faces. */
function boxShape() {
  return {
    __edges: Array.from({ length: 12 }, (_, i) => ({ id: `e${i}` })),
    __faces: Array.from({ length: 6 }, (_, i) => ({ id: `f${i}` })),
  };
}

describe("parseGeometryIndex", () => {
  it("extracts the trailing index from an edge ref", () => {
    expect(parseGeometryIndex("edge-3")).toBe(3);
  });

  it("extracts the trailing index from a face ref", () => {
    expect(parseGeometryIndex("face-0")).toBe(0);
  });

  it("returns NaN for a ref without a numeric suffix", () => {
    expect(parseGeometryIndex("edge-")).toBeNaN();
    expect(parseGeometryIndex("garbage")).toBeNaN();
  });
});

describe("resolveSubShapes", () => {
  it("maps 0-based edge refs to 1-based OCC map keys", () => {
    const edges = resolveSubShapes(mockCtx(), boxShape(), ["edge-0", "edge-11"], "edge");
    // edge-0 -> FindKey(1) -> e0 ; edge-11 -> FindKey(12) -> e11
    expect(edges).toEqual([{ edge: { id: "e0" } }, { edge: { id: "e11" } }]);
  });

  it("maps face refs through the face map", () => {
    const faces = resolveSubShapes(mockCtx(), boxShape(), ["face-2"], "face");
    expect(faces).toEqual([{ face: { id: "f2" } }]);
  });

  it("skips out-of-range and malformed refs", () => {
    const edges = resolveSubShapes(
      mockCtx(),
      boxShape(),
      ["edge-99", "edge-", "edge-1"],
      "edge"
    );
    expect(edges).toEqual([{ edge: { id: "e1" } }]);
  });
});

describe("applyFillet", () => {
  it("throws when no edges are provided", () => {
    const params: FilletParams = { radius: 2, edges: [] };
    expect(() => applyFillet(mockCtx(), boxShape(), params)).toThrow(/edge/i);
  });

  it("throws when the radius is not positive", () => {
    const params: FilletParams = { radius: 0, edges: ["edge-0"] };
    expect(() => applyFillet(mockCtx(), boxShape(), params)).toThrow(/radius/i);
  });

  it("throws when no edge refs resolve to real edges", () => {
    const params: FilletParams = { radius: 2, edges: ["edge-99"] };
    expect(() => applyFillet(mockCtx(), boxShape(), params)).toThrow(/edge/i);
  });

  it("adds the radius for each resolved edge and returns the built shape", () => {
    const rec: any = {};
    const params: FilletParams = { radius: 2.5, edges: ["edge-0", "edge-1"] };
    const result = applyFillet(mockCtx(rec), boxShape(), params);
    expect(rec.fillet.adds).toEqual([
      { radius: 2.5, edge: { edge: { id: "e0" } } },
      { radius: 2.5, edge: { edge: { id: "e1" } } },
    ]);
    expect(rec.fillet.built).toBe(true);
    expect(result).toEqual({ filleted: true });
  });

  it("throws when the OCC builder reports not done", () => {
    const rec: any = { filletDone: false };
    const params: FilletParams = { radius: 2, edges: ["edge-0"] };
    expect(() => applyFillet(mockCtx(rec), boxShape(), params)).toThrow(/fillet/i);
  });
});

describe("applyChamfer", () => {
  it("throws when no edges are provided", () => {
    const params: ChamferParams = { distance: 2, edges: [] };
    expect(() => applyChamfer(mockCtx(), boxShape(), params)).toThrow(/edge/i);
  });

  it("throws when the distance is not positive", () => {
    const params: ChamferParams = { distance: -1, edges: ["edge-0"] };
    expect(() => applyChamfer(mockCtx(), boxShape(), params)).toThrow(/distance/i);
  });

  it("adds the distance for each resolved edge and returns the built shape", () => {
    const rec: any = {};
    const params: ChamferParams = { distance: 1.5, edges: ["edge-3"] };
    const result = applyChamfer(mockCtx(rec), boxShape(), params);
    expect(rec.chamfer.adds).toEqual([{ distance: 1.5, edge: { edge: { id: "e3" } } }]);
    expect(result).toEqual({ chamfered: true });
  });
});

describe("applyShell", () => {
  it("throws when no faces to remove are provided", () => {
    const params: ShellParams = { thickness: 2, faces: [] };
    expect(() => applyShell(mockCtx(), boxShape(), params)).toThrow(/face/i);
  });

  it("throws when the thickness is zero", () => {
    const params: ShellParams = { thickness: 0, faces: ["face-0"] };
    expect(() => applyShell(mockCtx(), boxShape(), params)).toThrow(/thickness/i);
  });

  it("passes the resolved faces and thickness to MakeThickSolidByJoin", () => {
    const rec: any = {};
    const params: ShellParams = { thickness: -3, faces: ["face-0", "face-5"] };
    const result = applyShell(mockCtx(rec), boxShape(), params);
    const args = rec.shell.joinArgs;
    // args: [shape, list, offset, tol, mode, intersection, selfInter, join, removeIntEdges, range]
    expect(args[2]).toBe(-3); // thickness/offset
    expect(args[1].items).toEqual([{ face: { id: "f0" } }, { face: { id: "f5" } }]);
    expect(result).toEqual({ shelled: true });
  });
});

describe("applyOffset", () => {
  it("throws when the distance is zero", () => {
    const params: OffsetParams = { distance: 0, faces: [] };
    expect(() => applyOffset(mockCtx(), boxShape(), params)).toThrow(/distance/i);
  });

  it("offsets the whole body by the given distance via PerformByJoin", () => {
    const rec: any = {};
    const params: OffsetParams = { distance: 4, faces: [] };
    const result = applyOffset(mockCtx(rec), boxShape(), params);
    const args = rec.offset.joinArgs;
    // args: [shape, offset, tol, mode, intersection, selfInter, join, removeIntEdges, range]
    expect(args[1]).toBe(4);
    expect(result).toEqual({ offset: true });
  });
});
