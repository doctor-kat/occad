import { describe, it, expect } from "vitest";
import {
  computeFingerprint,
  fingerprintAll,
  fingerprintScore,
  matchFingerprint,
  resolveStableRef,
  type Fingerprint,
  type StableRef,
} from "./fingerprint";

/**
 * Faithful-but-WASM-free mock of the OCC calls fingerprint.ts makes. A face/edge
 * is modelled as { g: geomType, m: measure, c: centroid, h: obb half-sizes }.
 * The mock mirrors the real signatures (GProp_GProps_1 + BRepGProp,
 * Bnd_OBB_1 + BRepBndLib.AddOBB, BRepAdaptor_*.GetType) so the same code path
 * runs here as against the kernel.
 */
type Sub = { g: string; m: number; c: { x: number; y: number; z: number }; h: [number, number, number] };

function mockCtx() {
  const oc = {
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
      constructor(face: Sub) {
        this._g = face.g;
      }
      GetType() {
        return this._g;
      }
      delete() {}
    },
    BRepAdaptor_Curve_2: class {
      _g: string;
      constructor(edge: Sub) {
        this._g = edge.g;
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
      SurfaceProperties_1: (sub: Sub, props: any) => {
        props._m = sub.m;
        props._c = sub.c;
      },
      LinearProperties: (sub: Sub, props: any) => {
        props._m = sub.m;
        props._c = sub.c;
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
      AddOBB: (sub: Sub, obb: any) => {
        obb._h = sub.h;
      },
    },
  };
  return { oc } as any;
}

const face = (
  g: string,
  m: number,
  c: { x: number; y: number; z: number },
  h: [number, number, number]
): Sub => ({ g, m, c, h });

/** A box-like body: 6 planar faces, each geometrically distinct. */
function boxBody() {
  return {
    __faces: [
      face("plane", 100, { x: 5, y: 5, z: 0 }, [0, 5, 5]), // 0 bottom
      face("plane", 100, { x: 5, y: 5, z: 10 }, [0, 5, 5]), // 1 top
      face("plane", 80, { x: 5, y: 0, z: 5 }, [0, 4, 5]), // 2 front
      face("plane", 80, { x: 5, y: 10, z: 5 }, [0, 4, 5]), // 3 back
      face("plane", 60, { x: 0, y: 5, z: 5 }, [0, 3, 5]), // 4 left
      face("plane", 60, { x: 10, y: 5, z: 5 }, [0, 3, 5]), // 5 right
    ],
  };
}

describe("computeFingerprint / fingerprintAll", () => {
  it("captures type, measure, centroid and sorted OBB for each face", () => {
    const fps = fingerprintAll(mockCtx(), boxBody(), "face");
    expect(fps).toHaveLength(6);
    expect(fps[1]).toEqual<Fingerprint>({
      kind: "face",
      index: 1,
      geomType: "plane",
      measure: 100,
      centroid: { x: 5, y: 5, z: 10 },
      obb: [0, 5, 5],
    });
  });

  it("is deterministic — recomputing yields an identical fingerprint", () => {
    const ctx = mockCtx();
    const body = boxBody();
    const a = fingerprintAll(ctx, body, "face");
    const b = fingerprintAll(ctx, body, "face");
    expect(a).toEqual(b);
  });

  it("sorts OBB half-sizes so the signature is axis-order invariant", () => {
    const ctx = mockCtx();
    const sub = face("plane", 50, { x: 0, y: 0, z: 0 }, [5, 1, 3]);
    const fp = computeFingerprint(ctx, sub, "face", 0);
    expect(fp.obb).toEqual([1, 3, 5]);
  });

  it("reads edge length via LinearProperties and curve type via the curve adaptor", () => {
    const body = {
      __edges: [
        { g: "line", m: 10, c: { x: 0, y: 0, z: 5 }, h: [0, 0, 5] },
        { g: "circle", m: 6.28, c: { x: 5, y: 5, z: 5 }, h: [0, 1, 1] },
      ],
    };
    const fps = fingerprintAll(mockCtx(), body, "edge");
    expect(fps[0]).toMatchObject({ kind: "edge", geomType: "line", measure: 10 });
    expect(fps[1]).toMatchObject({ kind: "edge", geomType: "circle", measure: 6.28 });
  });
});

describe("fingerprintScore", () => {
  it("is 0 for identical fingerprints", () => {
    const [fp] = fingerprintAll(mockCtx(), boxBody(), "face");
    expect(fingerprintScore(fp, fp)).toBe(0);
  });

  it("is Infinity across different geometric types (never matches plane to cylinder)", () => {
    const ctx = mockCtx();
    const plane = computeFingerprint(ctx, face("plane", 50, { x: 0, y: 0, z: 0 }, [0, 5, 5]), "face", 0);
    const cyl = computeFingerprint(ctx, face("cylinder", 50, { x: 0, y: 0, z: 0 }, [0, 5, 5]), "face", 0);
    expect(fingerprintScore(plane, cyl)).toBe(Infinity);
  });

  it("grows as geometry diverges", () => {
    const ctx = mockCtx();
    const base = computeFingerprint(ctx, face("plane", 100, { x: 0, y: 0, z: 0 }, [0, 5, 5]), "face", 0);
    const near = computeFingerprint(ctx, face("plane", 100, { x: 0, y: 0, z: 0.1 }, [0, 5, 5]), "face", 0);
    const far = computeFingerprint(ctx, face("plane", 60, { x: 0, y: 0, z: 8 }, [0, 3, 5]), "face", 0);
    expect(fingerprintScore(base, near)).toBeLessThan(fingerprintScore(base, far));
  });
});

describe("matchFingerprint", () => {
  it("finds the geometrically-identical candidate regardless of its position", () => {
    const ctx = mockCtx();
    const original = fingerprintAll(ctx, boxBody(), "face");
    // Reverse the faces to simulate an edit that renumbered the index map.
    const shuffled = { __faces: [...boxBody().__faces].reverse() };
    const live = fingerprintAll(ctx, shuffled, "face");

    const target = original[1]; // the "top" face, captured at index 1
    const m = matchFingerprint(target, live);
    // top was index 1 of 6 originally -> index 4 after reversing.
    expect(m.index).toBe(4);
    expect(m.confident).toBe(true);
    expect(m.ambiguous).toBe(false);
  });

  it("flags an ambiguous match when two candidates are geometrically identical", () => {
    const ctx = mockCtx();
    const twin = face("plane", 100, { x: 5, y: 5, z: 10 }, [0, 5, 5]);
    const body = { __faces: [twin, face("plane", 60, { x: 0, y: 5, z: 5 }, [0, 3, 5]), twin] };
    const live = fingerprintAll(ctx, body, "face");
    const target = computeFingerprint(ctx, twin, "face", 0);

    const m = matchFingerprint(target, live);
    expect(m.ambiguous).toBe(true);
    expect(m.confident).toBe(false);
  });

  it("returns no confident match when the target geometry is absent", () => {
    const ctx = mockCtx();
    const live = fingerprintAll(ctx, boxBody(), "face");
    const absent = computeFingerprint(ctx, face("plane", 5, { x: 99, y: 99, z: 99 }, [0, 1, 1]), "face", 0);
    const m = matchFingerprint(absent, live);
    expect(m.confident).toBe(false);
  });
});

describe("resolveStableRef — the topological-naming fix", () => {
  it("re-finds a selection after an edit renumbers the index map", () => {
    const ctx = mockCtx();
    const fps = fingerprintAll(ctx, boxBody(), "face");
    // Selection captured against the original body: the "top" face at index 1.
    const ref: StableRef = { kind: "face", index: 1, fingerprint: fps[1] };

    // An upstream edit renumbers faces (modelled by reversing the map).
    const editedBody = { __faces: [...boxBody().__faces].reverse() };

    // Fingerprint resolution follows the geometry to its new index (4)...
    expect(resolveStableRef(ctx, editedBody, ref)).toBe(4);

    // ...whereas the bare ordinal index would silently bind to the WRONG face.
    const indexOnly: StableRef = { kind: "face", index: 1 };
    expect(resolveStableRef(ctx, editedBody, indexOnly)).toBe(1);
    const liveAtIndex1 = fingerprintAll(ctx, editedBody, "face")[1];
    expect(liveAtIndex1.centroid).not.toEqual(ref.fingerprint!.centroid);
  });

  it("trusts the fingerprint over a now-stale stored index", () => {
    const ctx = mockCtx();
    const fps = fingerprintAll(ctx, boxBody(), "face");
    // Stored index is wrong (5) but the fingerprint is the top face (really 1).
    const ref: StableRef = { kind: "face", index: 5, fingerprint: fps[1] };
    expect(resolveStableRef(ctx, boxBody(), ref)).toBe(1);
  });

  it("falls back to the ordinal index when no fingerprint is stored", () => {
    const ctx = mockCtx();
    const ref: StableRef = { kind: "face", index: 3 };
    expect(resolveStableRef(ctx, boxBody(), ref)).toBe(3);
  });

  it("returns -1 for an out-of-range index with no usable fingerprint", () => {
    const ctx = mockCtx();
    const ref: StableRef = { kind: "face", index: 99 };
    expect(resolveStableRef(ctx, boxBody(), ref)).toBe(-1);
  });

  it("returns -1 when the geometry is gone and the index is also out of range", () => {
    const ctx = mockCtx();
    const fps = fingerprintAll(ctx, boxBody(), "face");
    const removed: StableRef = { kind: "face", index: 99, fingerprint: fps[1] };
    // Body now has only two faces, neither matching the captured top face.
    const tinyBody = {
      __faces: [
        face("cylinder", 30, { x: 0, y: 0, z: 0 }, [2, 2, 9]),
        face("plane", 12, { x: -9, y: -9, z: -9 }, [0, 2, 3]),
      ],
    };
    expect(resolveStableRef(ctx, tinyBody, removed)).toBe(-1);
  });
});
