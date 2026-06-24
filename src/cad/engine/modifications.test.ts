import { describe, it, expect } from "vitest";
import {
  parseGeometryIndex,
  resolveSubShapes,
  enrichRefs,
  applyFillet,
  applyChamfer,
  applyShell,
  applyOffset,
} from "./modifications";
import type { FilletParams, ChamferParams, ShellParams, OffsetParams, StableRef } from "@/cad/types";
import { computeFingerprint, fingerprintAll } from "./fingerprint";

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
    const { shapes, unresolved } = resolveSubShapes(
      mockCtx(),
      boxShape(),
      ["edge-0", "edge-11"],
      "edge"
    );
    // edge-0 -> FindKey(1) -> e0 ; edge-11 -> FindKey(12) -> e11
    expect(shapes).toEqual([{ edge: { id: "e0" } }, { edge: { id: "e11" } }]);
    expect(unresolved).toEqual([]);
  });

  it("maps face refs through the face map", () => {
    const { shapes, unresolved } = resolveSubShapes(mockCtx(), boxShape(), ["face-2"], "face");
    expect(shapes).toEqual([{ face: { id: "f2" } }]);
    expect(unresolved).toEqual([]);
  });

  it("reports out-of-range and malformed refs as unresolved (not silently dropped)", () => {
    const { shapes, unresolved } = resolveSubShapes(
      mockCtx(),
      boxShape(),
      ["edge-99", "edge-", "edge-1"],
      "edge"
    );
    // The one valid ref still resolves...
    expect(shapes).toEqual([{ edge: { id: "e1" } }]);
    // ...but the stale/garbage refs are surfaced rather than swallowed.
    expect(unresolved).toEqual(["edge-99", "edge-"]);
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

  // Determinism guard: if even ONE selected edge no longer resolves (e.g. an
  // upstream edit shifted the topology so edge-99 is now out of range), the
  // whole fillet must fail loudly. Silently filleting only the still-valid
  // edges would produce wrong geometry with no indication anything was lost.
  it("throws naming the unresolved refs when a selection is stale", () => {
    const params: FilletParams = { radius: 2, edges: ["edge-0", "edge-99"] };
    expect(() => applyFillet(mockCtx(), boxShape(), params)).toThrow(/edge-99/);
    expect(() => applyFillet(mockCtx(), boxShape(), params)).toThrow(/topology may have changed/i);
  });

  it("does not call the OCC builder at all when a selection is stale", () => {
    const rec: any = {};
    const params: FilletParams = { radius: 2, edges: ["edge-0", "edge-99"] };
    expect(() => applyFillet(mockCtx(rec), boxShape(), params)).toThrow();
    // Bailed before constructing the fillet maker — no partial work performed.
    expect(rec.fillet).toBeUndefined();
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

  it("throws naming the unresolved refs when a selection is stale", () => {
    const params: ChamferParams = { distance: 2, edges: ["edge-3", "edge-50"] };
    expect(() => applyChamfer(mockCtx(), boxShape(), params)).toThrow(/edge-50/);
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

  it("throws naming the unresolved refs when a face selection is stale", () => {
    const params: ShellParams = { thickness: 2, faces: ["face-0", "face-9"] };
    expect(() => applyShell(mockCtx(), boxShape(), params)).toThrow(/face-9/);
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

/**
 * Fingerprint-aware resolution: the determinism payoff. A selection stored as a
 * fingerprinted StableRef must re-find its geometry after an upstream edit
 * renumbers the OCC index map — where a bare ordinal index would silently bind
 * to the wrong sub-shape. Uses a richer mock that implements the GProp / OBB /
 * adaptor calls fingerprint.ts makes, plus the fillet maker for an end-to-end
 * check. Sub-shapes are identity-mapped so a resolved shape IS the geometry obj.
 */
type Geo = { id: string; g: string; m: number; c: { x: number; y: number; z: number }; h: [number, number, number] };

function fpCtx(recorder: any = {}) {
  const oc: any = {
    TopAbs_ShapeEnum: { TopAbs_EDGE: "EDGE", TopAbs_FACE: "FACE" },
    TopExp: {
      MapShapes_1: (shape: any, kind: any, map: any) => {
        map._items = kind === "EDGE" ? shape.__edges ?? [] : shape.__faces ?? [];
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
    TopoDS: { Edge_1: (s: any) => s, Face_1: (s: any) => s },
    GeomAbs_SurfaceType: {
      GeomAbs_Plane: "plane",
      GeomAbs_Cylinder: "cylinder",
      GeomAbs_Cone: "cone",
      GeomAbs_Sphere: "sphere",
      GeomAbs_Torus: "torus",
      GeomAbs_BSplineSurface: "bspline",
    },
    GeomAbs_CurveType: {
      GeomAbs_Line: "line",
      GeomAbs_Circle: "circle",
      GeomAbs_Ellipse: "ellipse",
      GeomAbs_BSplineCurve: "bspline",
    },
    BRepAdaptor_Surface_2: class {
      _g: string;
      constructor(f: Geo) {
        this._g = f.g;
      }
      GetType() {
        return this._g;
      }
      delete() {}
    },
    BRepAdaptor_Curve_2: class {
      _g: string;
      constructor(e: Geo) {
        this._g = e.g;
      }
      GetType() {
        return this._g;
      }
      delete() {}
    },
    GProp_GProps_1: class {
      _m = 0;
      _c = { x: 0, y: 0, z: 0 };
      Mass() {
        return this._m;
      }
      CentreOfMass() {
        const c = this._c;
        return { X: () => c.x, Y: () => c.y, Z: () => c.z, delete() {} };
      }
      delete() {}
    },
    BRepGProp: {
      SurfaceProperties_1: (s: Geo, p: any) => {
        p._m = s.m;
        p._c = s.c;
      },
      LinearProperties: (s: Geo, p: any) => {
        p._m = s.m;
        p._c = s.c;
      },
    },
    Bnd_OBB_1: class {
      _h: [number, number, number] = [0, 0, 0];
      XHSize() {
        return this._h[0];
      }
      YHSize() {
        return this._h[1];
      }
      ZHSize() {
        return this._h[2];
      }
      Center() {
        return { X: () => 0, Y: () => 0, Z: () => 0 };
      }
      delete() {}
    },
    BRepBndLib: {
      AddOBB: (s: Geo, obb: any) => {
        obb._h = s.h;
      },
    },
    ChFi3d_FilletShape: { ChFi3d_Rational: "rational" },
    Message_ProgressRange_1: class {
      delete() {}
    },
    BRepFilletAPI_MakeFillet: class {
      constructor(shape: any, fshape: any) {
        recorder.fillet = { shape, fshape, adds: [] as any[], built: false };
      }
      Add_2(radius: number, edge: any) {
        recorder.fillet.adds.push({ radius, edge });
      }
      Build() {
        recorder.fillet.built = true;
      }
      IsDone() {
        return true;
      }
      Shape() {
        return { filleted: true };
      }
      delete() {}
    },
  };
  return { oc } as any;
}

const geoFace = (
  id: string,
  m: number,
  c: { x: number; y: number; z: number },
  h: [number, number, number]
): Geo => ({ id, g: "plane", m, c, h });

const geoEdge = (
  id: string,
  m: number,
  c: { x: number; y: number; z: number },
  h: [number, number, number]
): Geo => ({ id, g: "line", m, c, h });

/** Box-like body: 6 distinct planar faces + 4 distinct linear edges. */
function geoBody() {
  return {
    __faces: [
      geoFace("F-bottom", 100, { x: 5, y: 5, z: 0 }, [0, 5, 5]),
      geoFace("F-top", 100, { x: 5, y: 5, z: 10 }, [0, 5, 5]),
      geoFace("F-front", 80, { x: 5, y: 0, z: 5 }, [0, 4, 5]),
      geoFace("F-back", 80, { x: 5, y: 10, z: 5 }, [0, 4, 5]),
      geoFace("F-left", 60, { x: 0, y: 5, z: 5 }, [0, 3, 5]),
      geoFace("F-right", 60, { x: 10, y: 5, z: 5 }, [0, 3, 5]),
    ],
    __edges: [
      geoEdge("E-a", 10, { x: 5, y: 0, z: 0 }, [0, 0, 5]),
      geoEdge("E-b", 12, { x: 10, y: 5, z: 0 }, [0, 0, 6]),
      geoEdge("E-c", 14, { x: 5, y: 10, z: 0 }, [0, 0, 7]),
      geoEdge("E-d", 16, { x: 0, y: 5, z: 0 }, [0, 0, 8]),
    ],
  };
}

/** Reverse a sub-shape array — models an edit that renumbered the index map. */
function renumbered(body: ReturnType<typeof geoBody>) {
  return { __faces: [...body.__faces].reverse(), __edges: [...body.__edges].reverse() };
}

describe("resolveSubShapes — fingerprinted StableRefs", () => {
  it("re-finds a face after the index map is renumbered", () => {
    const fps = fingerprintAll(fpCtx(), geoBody(), "face");
    const topRef: StableRef = { kind: "face", index: 1, fingerprint: fps[1] }; // F-top

    const { shapes, unresolved } = resolveSubShapes(fpCtx(), renumbered(geoBody()), [topRef], "face");
    expect(unresolved).toEqual([]);
    expect(shapes).toHaveLength(1);
    expect((shapes[0] as Geo).id).toBe("F-top"); // geometry, not "whatever is now at index 1"
  });

  it("trusts the fingerprint over a stale stored index", () => {
    const fps = fingerprintAll(fpCtx(), geoBody(), "face");
    // index says 5 (F-right) but the fingerprint is F-top.
    const ref: StableRef = { kind: "face", index: 5, fingerprint: fps[1] };
    const { shapes } = resolveSubShapes(fpCtx(), geoBody(), [ref], "face");
    expect((shapes[0] as Geo).id).toBe("F-top");
  });

  it("contrasts with a bare index, which binds to the wrong face after renumber", () => {
    // Demonstrates the bug the fingerprint fixes: same logical selection, two refs.
    const fps = fingerprintAll(fpCtx(), geoBody(), "face");
    const edited = renumbered(geoBody());

    const stable = resolveSubShapes(fpCtx(), edited, [{ kind: "face", index: 1, fingerprint: fps[1] }], "face");
    const bare = resolveSubShapes(fpCtx(), edited, ["face-1"], "face");

    expect((stable.shapes[0] as Geo).id).toBe("F-top"); // correct
    expect((bare.shapes[0] as Geo).id).not.toBe("F-top"); // silently wrong
  });

  it("marks a fingerprint with no confident match and an out-of-range index as unresolved", () => {
    const ctx = fpCtx();
    const absent = computeFingerprint(ctx, geoFace("ghost", 5, { x: 99, y: 99, z: 99 }, [0, 1, 1]), "face", 0);
    const ref: StableRef = { kind: "face", index: 50, fingerprint: absent };
    const { shapes, unresolved } = resolveSubShapes(fpCtx(), geoBody(), [ref], "face");
    expect(shapes).toHaveLength(0);
    expect(unresolved).toEqual(["face-50"]); // refLabel(StableRef) = `${kind}-${index}`
  });

  it("resolves a mix of bare strings and fingerprinted refs", () => {
    const fps = fingerprintAll(fpCtx(), geoBody(), "face");
    const edited = renumbered(geoBody());
    const refs = ["face-0", { kind: "face", index: 1, fingerprint: fps[2] } as StableRef]; // F-front
    const { shapes, unresolved } = resolveSubShapes(fpCtx(), edited, refs, "face");
    expect(unresolved).toEqual([]);
    // "face-0" is positional (now F-right after reverse); the StableRef tracks F-front.
    expect((shapes[0] as Geo).id).toBe("F-right");
    expect((shapes[1] as Geo).id).toBe("F-front");
  });

  it("re-finds an edge after renumber (applyFillet end-to-end)", () => {
    const fps = fingerprintAll(fpCtx(), geoBody(), "edge");
    const edgeRef: StableRef = { kind: "edge", index: 2, fingerprint: fps[2] }; // E-c
    const rec: any = {};
    const params: FilletParams = { radius: 3, edges: [edgeRef] };

    const result = applyFillet(fpCtx(rec), renumbered(geoBody()), params);
    expect(result).toEqual({ filleted: true });
    expect(rec.fillet.adds).toHaveLength(1);
    expect(rec.fillet.adds[0].radius).toBe(3);
    expect((rec.fillet.adds[0].edge as Geo).id).toBe("E-c"); // followed the geometry
  });

  it("is deterministic — repeated resolution yields the same sub-shape", () => {
    const fps = fingerprintAll(fpCtx(), geoBody(), "face");
    const ref: StableRef = { kind: "face", index: 3, fingerprint: fps[3] };
    const a = resolveSubShapes(fpCtx(), renumbered(geoBody()), [ref], "face");
    const b = resolveSubShapes(fpCtx(), renumbered(geoBody()), [ref], "face");
    expect((a.shapes[0] as Geo).id).toBe((b.shapes[0] as Geo).id);
    expect((a.shapes[0] as Geo).id).toBe("F-back");
  });
});

describe("enrichRefs — lazy fingerprint capture", () => {
  it("attaches a fingerprint to a bare edge ref, anchored to its current geometry", () => {
    const enriched = enrichRefs(fpCtx(), geoBody(), ["edge-2"], "edge");
    expect(enriched).not.toBeNull();
    const ref = enriched![0] as StableRef;
    expect(ref.kind).toBe("edge");
    expect(ref.index).toBe(2);
    expect(ref.fingerprint).toBeDefined();
    expect(ref.fingerprint!.measure).toBe(14); // E-c length
  });

  it("captures fingerprints for faces too", () => {
    const enriched = enrichRefs(fpCtx(), geoBody(), ["face-1"], "face");
    const ref = enriched![0] as StableRef;
    expect(ref.fingerprint!.centroid).toEqual({ x: 5, y: 5, z: 10 }); // F-top
  });

  it("returns null when every ref already carries a fingerprint (capture has converged)", () => {
    const fps = fingerprintAll(fpCtx(), geoBody(), "edge");
    const already: StableRef = { kind: "edge", index: 1, fingerprint: fps[1] };
    expect(enrichRefs(fpCtx(), geoBody(), [already], "edge")).toBeNull();
  });

  it("returns null for an empty selection", () => {
    expect(enrichRefs(fpCtx(), geoBody(), [], "face")).toBeNull();
  });

  it("leaves an unresolved ref untouched (so apply still fails loudly) but enriches the rest", () => {
    const enriched = enrichRefs(fpCtx(), geoBody(), ["edge-0", "edge-99"], "edge");
    expect(enriched).not.toBeNull();
    expect((enriched![0] as StableRef).fingerprint).toBeDefined(); // edge-0 captured
    expect(enriched![1]).toBe("edge-99"); // out of range -> kept as the bare string
  });

  it("captured fingerprints then survive a later renumber (capture + resolve round trip)", () => {
    // Capture against the original body...
    const enriched = enrichRefs(fpCtx(), geoBody(), ["face-1"], "face")!;
    // ...then resolve the enriched ref against a renumbered body.
    const { shapes, unresolved } = resolveSubShapes(fpCtx(), renumbered(geoBody()), enriched, "face");
    expect(unresolved).toEqual([]);
    expect((shapes[0] as Geo).id).toBe("F-top");
  });
});
