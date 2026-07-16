import { describe, it, expect } from "vitest";
import { measureShape, measureBetween } from "@/cad/solid/analysis";
import type { WorkerContext } from "@/cad/solid/workerContext";

/**
 * Fake OpenCascade context for exercising the measurement control flow without
 * the WASM kernel. As with io.test.ts, real geometric accuracy is covered by the
 * browser pass; here we verify the volume + bounding-box tools are driven and the
 * corners map into the returned MeasurementData. ⚠️ Cannot catch a wrong OCC
 * constructor/method name (runtime-only) — confirm real values in the browser.
 */

function pnt(x: number, y: number, z: number) {
  return { X: () => x, Y: () => y, Z: () => z, delete() {} };
}

function mockCtx(rec: any = {}, opts: { volume?: number; min?: [number, number, number]; max?: [number, number, number] } = {}) {
  const { volume = 1000, min = [0, 0, 0], max = [10, 20, 30] } = opts;

  const oc: any = {
    GProp_GProps_1: class {
      Mass() { return volume; }
      delete() {}
    },
    BRepGProp: {
      VolumeProperties_1(shape: any, _props: any, ..._rest: any[]) { rec.volumeShape = shape; },
    },
    Bnd_Box_1: class {
      CornerMin() { return pnt(min[0], min[1], min[2]); }
      CornerMax() { return pnt(max[0], max[1], max[2]); }
      delete() {}
    },
    BRepBndLib: {
      Add(shape: any, _box: any, _useTri: boolean) { rec.bndShape = shape; },
    },
  };
  return { oc, shapeStorage: new Map() } as unknown as WorkerContext;
}

const shape = () => ({ __kind: "SOLID" });

describe("measureShape", () => {
  it("returns the volume from GProp_GProps.Mass()", () => {
    const ctx = mockCtx({}, { volume: 2500 });
    expect(measureShape(ctx, shape()).volume).toBe(2500);
  });

  it("maps bounding-box corners into min/max/size", () => {
    const ctx = mockCtx({}, { min: [1, 2, 3], max: [11, 22, 33] });
    const { boundingBox } = measureShape(ctx, shape());
    expect(boundingBox.min).toEqual({ x: 1, y: 2, z: 3 });
    expect(boundingBox.max).toEqual({ x: 11, y: 22, z: 33 });
    expect(boundingBox.size).toEqual({ x: 10, y: 20, z: 30 });
  });

  it("drives both the volume and bounding-box tools with the shape", () => {
    const rec: any = {};
    const ctx = mockCtx(rec);
    const s = shape();
    measureShape(ctx, s);
    expect(rec.volumeShape).toBe(s);
    expect(rec.bndShape).toBe(s);
  });
});

/**
 * Fake context for measureBetween: sub-shapes carry a `dir` (planar-face normal
 * or line-edge tangent) and the distance tool returns a configured value + point
 * pair. Same caveat as measureShape — the OCC method names are runtime-only.
 */
type Sub = { dir?: { x: number; y: number; z: number }; curved?: boolean };

function betweenCtx(opts: {
  faces?: Sub[];
  edges?: Sub[];
  vertices?: Sub[];
  distance?: number;
  p1?: [number, number, number];
  p2?: [number, number, number];
}): WorkerContext {
  const { faces = [], edges = [], vertices = [], distance = 5, p1 = [0, 0, 0], p2 = [5, 0, 0] } = opts;
  const dir = (v?: { x: number; y: number; z: number }) => ({ X: () => v?.x ?? 0, Y: () => v?.y ?? 0, Z: () => v?.z ?? 0 });

  const oc: any = {
    TopAbs_ShapeEnum: { TopAbs_FACE: "FACE", TopAbs_EDGE: "EDGE", TopAbs_VERTEX: "VERTEX" },
    TopExp: {
      MapShapes_1: (shape: any, kind: any, map: any) => {
        map._items = kind === "FACE" ? shape.faces : kind === "EDGE" ? shape.edges : shape.vertices;
      },
    },
    TopTools_IndexedMapOfShape_1: class {
      _items: any[] = [];
      Extent() { return this._items.length; }
      FindKey(i: number) { return this._items[i - 1]; }
      delete() {}
    },
    TopoDS: { Edge_1: (s: any) => s, Face_1: (s: any) => s, Vertex_1: (s: any) => s },
    GeomAbs_SurfaceType: { GeomAbs_Plane: "plane" },
    GeomAbs_CurveType: { GeomAbs_Line: "line" },
    BRepAdaptor_Surface_2: class {
      constructor(private s: Sub) {}
      GetType() { return this.s.curved ? "other" : "plane"; }
      Plane() { return { Axis: () => ({ Direction: () => dir(this.s.dir) }) }; }
      delete() {}
    },
    BRepAdaptor_Curve_2: class {
      constructor(private s: Sub) {}
      GetType() { return this.s.curved ? "other" : "line"; }
      Line() { return { Direction: () => dir(this.s.dir) }; }
      delete() {}
    },
    Message_ProgressRange_1: class { delete() {} },
    Extrema_ExtFlag: { Extrema_ExtFlag_MIN: {} },
    Extrema_ExtAlgo: { Extrema_ExtAlgo_Grad: {} },
    BRepExtrema_DistShapeShape_2: class {
      IsDone() { return true; }
      NbSolution() { return 1; }
      Value() { return distance; }
      PointOnShape1() { return pnt(p1[0], p1[1], p1[2]); }
      PointOnShape2() { return pnt(p2[0], p2[1], p2[2]); }
      delete() {}
    },
  };
  return { oc, shapeStorage: new Map() } as unknown as WorkerContext;
}

describe("measureBetween", () => {
  it("returns the distance and closest-point pair", () => {
    const ctx = betweenCtx({ faces: [{}, {}], distance: 7.5, p1: [1, 2, 3], p2: [4, 2, 3] });
    const r = measureBetween(ctx, { faces: [{}, {}], edges: [], vertices: [] }, { kind: "face", index: 0 }, { kind: "face", index: 1 });
    expect(r.distance).toBe(7.5);
    expect(r.pointA).toEqual({ x: 1, y: 2, z: 3 });
    expect(r.pointB).toEqual({ x: 4, y: 2, z: 3 });
  });

  it("reports the acute angle between two non-parallel planar faces", () => {
    const faces: Sub[] = [{ dir: { x: 1, y: 0, z: 0 } }, { dir: { x: 0, y: 1, z: 0 } }];
    const ctx = betweenCtx({ faces });
    const r = measureBetween(ctx, { faces, edges: [], vertices: [] }, { kind: "face", index: 0 }, { kind: "face", index: 1 });
    expect(r.angle).toBeCloseTo(90, 5);
  });

  it("folds obtuse normal angles to the acute angle between faces", () => {
    // normals 120° apart -> acute angle 60°
    const faces: Sub[] = [{ dir: { x: 1, y: 0, z: 0 } }, { dir: { x: -0.5, y: Math.sqrt(3) / 2, z: 0 } }];
    const ctx = betweenCtx({ faces });
    const r = measureBetween(ctx, { faces, edges: [], vertices: [] }, { kind: "face", index: 0 }, { kind: "face", index: 1 });
    expect(r.angle).toBeCloseTo(60, 5);
  });

  it("omits the angle for parallel selections", () => {
    const faces: Sub[] = [{ dir: { x: 0, y: 0, z: 1 } }, { dir: { x: 0, y: 0, z: -1 } }];
    const ctx = betweenCtx({ faces });
    const r = measureBetween(ctx, { faces, edges: [], vertices: [] }, { kind: "face", index: 0 }, { kind: "face", index: 1 });
    expect(r.angle).toBeUndefined();
  });

  it("omits the angle when a selection is a vertex (non-directional)", () => {
    const ctx = betweenCtx({ faces: [{ dir: { x: 1, y: 0, z: 0 } }], vertices: [{}] });
    const r = measureBetween(
      ctx,
      { faces: [{ dir: { x: 1, y: 0, z: 0 } }], edges: [], vertices: [{}] },
      { kind: "face", index: 0 },
      { kind: "vertex", index: 0 },
    );
    expect(r.angle).toBeUndefined();
  });

  it("throws when a selection index is out of range", () => {
    const ctx = betweenCtx({ faces: [{}] });
    expect(() =>
      measureBetween(ctx, { faces: [{}], edges: [], vertices: [] }, { kind: "face", index: 0 }, { kind: "face", index: 3 }),
    ).toThrow(/face 3 not found/);
  });
});
