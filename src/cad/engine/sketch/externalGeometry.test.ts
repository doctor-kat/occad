import { describe, it, expect } from "vitest";
import {
  findShapeByTag,
  findShapeByRef,
  enrichSketchExternalRefs,
  reprojectExternalGeometry,
} from "./externalGeometry";
import { computeFingerprint } from "../fingerprint";
import type { Sketch, SketchPrimitive, StableRef, Workplane } from "../../types";

/**
 * Mock OCC focused on the external-geometry path. External sketch geometry is
 * anchored to a solid's *vertices* and *edges*; vertices fingerprint purely from
 * their world point (`BRep_Tool.Pnt`), so the fingerprint re-find path is driven
 * here with vertices and a small mock — no GProp/OBB surface needed. Real kernel
 * validity is covered by the e2e face-based sketching suite.
 *
 * A body is `{ __vertices, __edges, __faces }`; sub-shapes are identity-mapped so
 * a resolved shape IS the geometry object.
 */
type V = { id: string; p: { x: number; y: number; z: number }; ShapeType: () => string };

// Shared function reference so two `vtx()` results stay `toEqual`-comparable
// (vitest treats distinct closures as unequal).
const vertexShapeType = () => "VERTEX";

function vtx(id: string, x: number, y: number, z: number): V {
  return { id, p: { x, y, z }, ShapeType: vertexShapeType };
}

function mockCtx() {
  const VERTEX = "VERTEX";
  const oc: any = {
    TopAbs_ShapeEnum: { TopAbs_FACE: "FACE", TopAbs_EDGE: "EDGE", TopAbs_VERTEX: VERTEX },
    TopExp: {
      MapShapes_1: (shape: any, kind: any, map: any) => {
        map._items =
          kind === "VERTEX" ? shape.__vertices ?? [] : kind === "EDGE" ? shape.__edges ?? [] : shape.__faces ?? [];
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
      Vertex_1: (s: any) => s,
      Edge_1: (s: any) => s,
      Face_1: (s: any) => s,
    },
    BRep_Tool: {
      Pnt: (v: V) => ({ X: () => v.p.x, Y: () => v.p.y, Z: () => v.p.z, delete() {} }),
    },
  };
  return { oc } as any;
}

/** A body with four distinct vertices. */
function vbody() {
  return {
    __vertices: [
      vtx("V0", 0, 0, 0),
      vtx("V1", 10, 0, 0),
      vtx("V2", 10, 10, 0),
      vtx("V3", 0, 10, 0),
    ],
    __edges: [{ id: "E0" }, { id: "E1" }],
    __faces: [{ id: "F0" }],
  };
}

/** Reverse a body's sub-shape arrays — models an edit that renumbered the maps. */
function renumbered(b: ReturnType<typeof vbody>) {
  return {
    __vertices: [...b.__vertices].reverse(),
    __edges: [...b.__edges].reverse(),
    __faces: [...b.__faces].reverse(),
  };
}

const XY: Workplane = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
} as any;

function extPoint(id: string, sourceId: string, sourceRef?: StableRef): SketchPrimitive {
  return { id, type: "point", data: { x: 0, y: 0 }, fixed: true, isExternal: true, sourceId, sourceRef };
}

function sketchWith(primitives: SketchPrimitive[]): Sketch {
  return {
    id: "S1",
    name: "S",
    workplane: XY,
    primitives,
    elements: [],
    constraints: [],
    visualMetadata: {},
    isClosed: false,
    isVisible: true,
    createdAt: 1,
    updatedAt: 1,
  } as any;
}

describe("findShapeByRef — positional (legacy bare tags)", () => {
  it("resolves a bare vertex tag by index", () => {
    expect(findShapeByRef(mockCtx(), vbody(), "vertex-2")).toEqual(vtx("V2", 10, 10, 0));
  });

  it("resolves a bare edge tag by index", () => {
    expect(findShapeByRef(mockCtx(), vbody(), "edge-1")).toEqual({ id: "E1" });
  });

  it("returns undefined for an out-of-range tag", () => {
    expect(findShapeByRef(mockCtx(), vbody(), "vertex-9")).toBeUndefined();
  });

  it("returns undefined for a malformed tag", () => {
    expect(findShapeByRef(mockCtx(), vbody(), "garbage")).toBeUndefined();
  });

  it("matches findShapeByTag for the legacy string path", () => {
    const ctx = mockCtx();
    const body = vbody();
    expect(findShapeByRef(ctx, body, "vertex-1")).toBe(findShapeByTag(ctx, body, "vertex-1"));
  });
});

describe("computeFingerprint — vertex", () => {
  it("fingerprints a vertex from its world point (zero measure / OBB)", () => {
    const fp = computeFingerprint(mockCtx(), vtx("V1", 10, 0, 0), "vertex", 1);
    expect(fp).toEqual({
      kind: "vertex",
      index: 1,
      geomType: "point",
      measure: 0,
      centroid: { x: 10, y: 0, z: 0 },
      obb: [0, 0, 0],
    });
  });
});

describe("findShapeByRef — fingerprinted StableRef", () => {
  it("re-finds a vertex by geometry after the index map is renumbered", () => {
    const fp = computeFingerprint(mockCtx(), vtx("V1", 10, 0, 0), "vertex", 1);
    const ref: StableRef = { kind: "vertex", index: 1, fingerprint: fp };
    // After reverse, index 1 is now V2 — but the fingerprint tracks V1.
    const found = findShapeByRef(mockCtx(), renumbered(vbody()), ref) as V;
    expect(found.id).toBe("V1");
  });

  it("contrasts with a bare index, which binds to the wrong vertex after renumber", () => {
    const bare = findShapeByRef(mockCtx(), renumbered(vbody()), "vertex-1") as V;
    expect(bare.id).not.toBe("V1"); // silently wrong (now V2)
  });
});

describe("enrichSketchExternalRefs — lazy capture", () => {
  it("captures a fingerprinted sourceRef for an external vertex primitive", () => {
    const sketch = sketchWith([extPoint("p1", "vertex-1")]);
    const out = enrichSketchExternalRefs(mockCtx(), sketch, vbody());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sketchId: "S1", primitiveId: "p1" });
    expect(out[0].ref.kind).toBe("vertex");
    expect(out[0].ref.index).toBe(1);
    expect(out[0].ref.fingerprint!.centroid).toEqual({ x: 10, y: 0, z: 0 }); // V1
  });

  it("skips a primitive whose sourceRef already carries a fingerprint (converged)", () => {
    const fp = computeFingerprint(mockCtx(), vtx("V1", 10, 0, 0), "vertex", 1);
    const sketch = sketchWith([extPoint("p1", "vertex-1", { kind: "vertex", index: 1, fingerprint: fp })]);
    expect(enrichSketchExternalRefs(mockCtx(), sketch, vbody())).toEqual([]);
  });

  it("skips non-external primitives and those without a sourceId", () => {
    const internal: SketchPrimitive = { id: "i", type: "point", data: {}, fixed: false };
    const noSource: SketchPrimitive = { id: "n", type: "point", data: {}, fixed: true, isExternal: true };
    expect(enrichSketchExternalRefs(mockCtx(), sketchWith([internal, noSource]), vbody())).toEqual([]);
  });

  it("skips a primitive whose tag no longer resolves (left bare for the tolerant reproject)", () => {
    const sketch = sketchWith([extPoint("p1", "vertex-99")]);
    expect(enrichSketchExternalRefs(mockCtx(), sketch, vbody())).toEqual([]);
  });
});

describe("reprojectExternalGeometry — sourceRef survives renumber", () => {
  it("projects from the fingerprint-tracked vertex, not the positionally-shifted one", () => {
    const fp = computeFingerprint(mockCtx(), vtx("V1", 10, 0, 0), "vertex", 1);
    const sketch = sketchWith([extPoint("p1", "vertex-1", { kind: "vertex", index: 1, fingerprint: fp })]);
    const out = reprojectExternalGeometry(mockCtx(), sketch, renumbered(vbody()));
    // V1 is at (10,0,0); projected onto XY that is (x:10, y:0).
    expect(out.primitives[0].data).toMatchObject({ x: 10, y: 0 });
  });

  it("a bare sourceId (no ref) drifts to the wrong vertex after renumber", () => {
    const sketch = sketchWith([extPoint("p1", "vertex-1")]);
    const out = reprojectExternalGeometry(mockCtx(), sketch, renumbered(vbody()));
    // index 1 after reverse is V2 at (10,10,0) -> wrong.
    expect(out.primitives[0].data).toMatchObject({ x: 10, y: 10 });
  });
});
