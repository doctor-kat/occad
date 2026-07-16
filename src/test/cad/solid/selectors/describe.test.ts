import { describe, it, expect } from 'vitest';
import { describeSubShapes } from '@/cad/solid/selectors/describe';
import { selectSubShapes } from '@/cad/solid/selectors/index';

/**
 * WASM-free mock of the OCC calls describe.ts makes. Extends the fingerprint.ts
 * mock surface (GProp/OBB/adaptor GetType) with the selection-only extractors:
 * planar-face normal (Plane().Axis().Direction() + orientation), cylinder/sphere
 * radius, line tangent (Line().Direction()), and circle radius.
 *
 * A sub-shape fixture: { g, m, c, h } base + optional n (normal/tangent), r
 * (radius), o ('rev' = reversed orientation → outward normal is flipped), p
 * (vertex point).
 */
type Vec = { x: number; y: number; z: number };
type Sub = {
  g: string; m: number; c: Vec; h: [number, number, number];
  n?: Vec; r?: number; o?: 'fwd' | 'rev'; p?: Vec;
};

const dir = (v?: Vec) => ({ X: () => v?.x ?? 0, Y: () => v?.y ?? 0, Z: () => v?.z ?? 0 });

function mockCtx() {
  const oc: any = {
    TopAbs_ShapeEnum: { TopAbs_EDGE: 'EDGE', TopAbs_FACE: 'FACE', TopAbs_VERTEX: 'VERTEX' },
    TopAbs_Orientation: { TopAbs_FORWARD: 'FWD', TopAbs_REVERSED: 'REV' },
    TopExp: {
      MapShapes_1: (shape: any, kind: any, map: any) => {
        map._items = kind === 'EDGE' ? shape.__edges ?? [] : kind === 'FACE' ? shape.__faces ?? [] : shape.__vertices ?? [];
      },
    },
    TopTools_IndexedMapOfShape_1: class {
      _items: any[] = [];
      Extent() { return this._items.length; }
      FindKey(i: number) { return this._items[i - 1]; }
      delete() {}
    },
    TopoDS: { Edge_1: (s: any) => s, Face_1: (s: any) => s, Vertex_1: (s: any) => s },
    GeomAbs_SurfaceType: {
      GeomAbs_Plane: 'plane', GeomAbs_Cylinder: 'cylinder', GeomAbs_Cone: 'cone',
      GeomAbs_Sphere: 'sphere', GeomAbs_Torus: 'torus', GeomAbs_BSplineSurface: 'bspline',
    },
    GeomAbs_CurveType: {
      GeomAbs_Line: 'line', GeomAbs_Circle: 'circle', GeomAbs_Ellipse: 'ellipse', GeomAbs_BSplineCurve: 'bspline',
    },
    BRepAdaptor_Surface_2: class {
      _s: Sub;
      constructor(face: Sub) { this._s = face; }
      GetType() { return this._s.g; }
      Plane() { return { Axis: () => ({ Direction: () => dir(this._s.n) }) }; }
      Cylinder() { return { Radius: () => this._s.r }; }
      Sphere() { return { Radius: () => this._s.r }; }
      delete() {}
    },
    BRepAdaptor_Curve_2: class {
      _s: Sub;
      constructor(edge: Sub) { this._s = edge; }
      GetType() { return this._s.g; }
      Line() { return { Direction: () => dir(this._s.n) }; }
      Circle() { return { Radius: () => this._s.r }; }
      delete() {}
    },
    GProp_GProps_1: class {
      _m = 0; _c = { x: 0, y: 0, z: 0 };
      Mass() { return this._m; }
      CentreOfMass() { const c = this._c; return { X: () => c.x, Y: () => c.y, Z: () => c.z, delete() {} }; }
      delete() {}
    },
    BRepGProp: {
      SurfaceProperties_1: (sub: Sub, props: any) => { props._m = sub.m; props._c = sub.c; },
      LinearProperties: (sub: Sub, props: any) => { props._m = sub.m; props._c = sub.c; },
    },
    Bnd_OBB_1: class {
      _h: [number, number, number] = [0, 0, 0];
      XHSize() { return this._h[0]; } YHSize() { return this._h[1]; } ZHSize() { return this._h[2]; }
      delete() {}
    },
    BRepBndLib: { AddOBB: (sub: Sub, obb: any) => { obb._h = sub.h; } },
    BRep_Tool: { Pnt: (v: Sub) => ({ X: () => v.p!.x, Y: () => v.p!.y, Z: () => v.p!.z, delete() {} }) },
  };
  return { oc } as any;
}

const face = (g: string, m: number, c: Vec, h: [number, number, number], extra: Partial<Sub> = {}): Sub => ({
  g, m, c, h, ...extra,
  // sub carries its own orientation accessor (identity-cast by TopoDS.Face_1).
  ...(({ Orientation_1: () => (extra.o === 'rev' ? 'REV' : 'FWD') } as any)),
});
const edge = (g: string, m: number, c: Vec, h: [number, number, number], extra: Partial<Sub> = {}): Sub =>
  ({ g, m, c, h, ...extra });

/** Unit box [0,10]^3: axis-aligned planar faces (one reversed) + a cylinder face. */
function bodyWithFaces() {
  return {
    __faces: [
      face('plane', 100, { x: 5, y: 5, z: 10 }, [0, 5, 5], { n: { x: 0, y: 0, z: 1 }, o: 'fwd' }),  // 0 top, outward +Z
      face('plane', 100, { x: 5, y: 5, z: 0 }, [0, 5, 5], { n: { x: 0, y: 0, z: 1 }, o: 'rev' }),   // 1 bottom: axis +Z but reversed → outward -Z
      face('plane', 80, { x: 10, y: 5, z: 5 }, [0, 4, 5], { n: { x: 1, y: 0, z: 0 }, o: 'fwd' }),   // 2 +X wall
      face('cylinder', 50, { x: 5, y: 5, z: 5 }, [3, 3, 5], { r: 3 }),                               // 3 cylinder (no planar normal)
    ],
  };
}

describe('describeSubShapes — faces', () => {
  it('extracts the outward normal of planar faces, flipping reversed orientation', () => {
    const d = describeSubShapes(mockCtx(), bodyWithFaces(), 'face');
    expect(d[0].direction).toEqual({ x: 0, y: 0, z: 1 });   // top outward +Z
    expect(d[1].direction).toEqual({ x: 0, y: 0, z: -1 });  // bottom flipped to -Z
    expect(d[2].direction).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('extracts radius for a cylindrical face and leaves its direction undefined', () => {
    const d = describeSubShapes(mockCtx(), bodyWithFaces(), 'face');
    expect(d[3].geomType).toBe('cylinder');
    expect(d[3].radius).toBe(3);
    expect(d[3].direction).toBeUndefined();
  });

  it('carries through the base fingerprint fields (index/measure/centroid)', () => {
    const d = describeSubShapes(mockCtx(), bodyWithFaces(), 'face');
    expect(d[0].index).toBe(0);
    expect(d[0].measure).toBe(100);
    expect(d[0].centroid).toEqual({ x: 5, y: 5, z: 10 });
  });
});

describe('describeSubShapes — edges', () => {
  function bodyWithEdges() {
    return {
      __edges: [
        edge('line', 10, { x: 0, y: 0, z: 5 }, [0, 0, 5], { n: { x: 0, y: 0, z: 1 } }),   // 0 vertical line
        edge('line', 10, { x: 5, y: 0, z: 0 }, [0, 0, 5], { n: { x: 1, y: 0, z: 0 } }),   // 1 horizontal line
        edge('circle', 18.8, { x: 5, y: 5, z: 0 }, [0, 3, 3], { r: 3 }),                   // 2 circle
      ],
    };
  }

  it('extracts the tangent of line edges', () => {
    const d = describeSubShapes(mockCtx(), bodyWithEdges(), 'edge');
    expect(d[0].direction).toEqual({ x: 0, y: 0, z: 1 });
    expect(d[1].direction).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('extracts radius for a circle edge, no direction', () => {
    const d = describeSubShapes(mockCtx(), bodyWithEdges(), 'edge');
    expect(d[2].geomType).toBe('circle');
    expect(d[2].radius).toBe(3);
    expect(d[2].direction).toBeUndefined();
  });
});

describe('describeSubShapes — vertices & normalization', () => {
  it('describes a vertex with no direction/radius', () => {
    const body = { __vertices: [{ g: 'point', m: 0, c: { x: 0, y: 0, z: 0 }, h: [0, 0, 0], p: { x: 1, y: 2, z: 3 } }] };
    const d = describeSubShapes(mockCtx(), body, 'vertex');
    expect(d[0]).toEqual({ kind: 'vertex', index: 0, geomType: 'point', measure: 0, centroid: { x: 1, y: 2, z: 3 }, obb: [0, 0, 0] });
  });

  it('normalizes a non-unit normal to length 1', () => {
    const body = { __faces: [face('plane', 1, { x: 0, y: 0, z: 0 }, [0, 1, 1], { n: { x: 0, y: 0, z: 5 } })] };
    const d = describeSubShapes(mockCtx(), body, 'face');
    expect(d[0].direction).toEqual({ x: 0, y: 0, z: 1 });
  });
});

describe('describe → select integration', () => {
  it('feeds selectSubShapes end-to-end: >Z finds the top face', () => {
    const d = describeSubShapes(mockCtx(), bodyWithFaces(), 'face');
    expect(selectSubShapes(d, '>Z')).toEqual([0]);
    expect(selectSubShapes(d, '|Z').sort((a, b) => a - b)).toEqual([0, 1]); // top + bottom horizontals
    expect(selectSubShapes(d, '%cylinder')).toEqual([3]);
  });
});
