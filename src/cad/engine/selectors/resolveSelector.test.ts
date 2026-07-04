import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResolveSelector } from '../operations';
import type { WorkerContext } from '../workerContext';

/**
 * WASM-free mock of the OCC calls describe.ts/fingerprint.ts make, mirroring
 * describe.test.ts's fixture shape. Covers the Phase 2 worker-wiring path:
 * shapeStorage lookup -> describeSubShapes -> selectSubShapes -> fingerprinted
 * StableRef[] posted back as `selectorResolved`.
 */
type Vec = { x: number; y: number; z: number };
type Sub = {
  g: string; m: number; c: Vec; h: [number, number, number];
  n?: Vec; o?: 'fwd' | 'rev';
};

const dir = (v?: Vec) => ({ X: () => v?.x ?? 0, Y: () => v?.y ?? 0, Z: () => v?.z ?? 0 });

function mockCtx(): WorkerContext {
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
      Cylinder() { return { Radius: () => 0 }; }
      Sphere() { return { Radius: () => 0 }; }
      delete() {}
    },
    BRepAdaptor_Curve_2: class {
      _s: Sub;
      constructor(edge: Sub) { this._s = edge; }
      GetType() { return this._s.g; }
      Line() { return { Direction: () => dir(this._s.n) }; }
      Circle() { return { Radius: () => 0 }; }
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
    BRep_Tool: { Pnt: (v: Sub) => ({ X: () => 0, Y: () => 0, Z: () => 0, delete() {} }) },
  };
  return { oc, shapeStorage: new Map() } as any;
}

const face = (g: string, m: number, c: Vec, h: [number, number, number], extra: Partial<Sub> = {}): Sub => ({
  g, m, c, h, ...extra,
  ...(({ Orientation_1: () => (extra.o === 'rev' ? 'REV' : 'FWD') } as any)),
});

/** Unit box: two horizontal (top/bottom) planar faces + a +X wall. */
function boxShape() {
  return {
    __faces: [
      face('plane', 100, { x: 5, y: 5, z: 10 }, [0, 5, 5], { n: { x: 0, y: 0, z: 1 }, o: 'fwd' }), // 0 top
      face('plane', 100, { x: 5, y: 5, z: 0 }, [0, 5, 5], { n: { x: 0, y: 0, z: 1 }, o: 'rev' }),  // 1 bottom
      face('plane', 80, { x: 10, y: 5, z: 5 }, [0, 4, 5], { n: { x: 1, y: 0, z: 0 }, o: 'fwd' }),  // 2 +X wall
    ],
  };
}

describe('handleResolveSelector', () => {
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postSpy = vi.spyOn(self, 'postMessage').mockImplementation(() => {});
  });

  it('resolves a selector to fingerprinted StableRef[] and posts selectorResolved', () => {
    const ctx = mockCtx();
    ctx.shapeStorage.set('body-1', boxShape());

    handleResolveSelector(ctx, 'req-1', 'body-1', 'face', '>Z');

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [msg] = postSpy.mock.calls[0];
    expect(msg).toMatchObject({ type: 'selectorResolved', requestId: 'req-1' });
    expect(msg.refs).toHaveLength(1);
    expect(msg.refs[0]).toMatchObject({ kind: 'face', index: 0 });
    expect(msg.refs[0].fingerprint).toMatchObject({ geomType: 'plane', measure: 100, centroid: { x: 5, y: 5, z: 10 } });
  });

  it('posts a scoped error when the shape is not found', () => {
    const ctx = mockCtx();

    handleResolveSelector(ctx, 'req-2', 'missing-shape', 'face', '>Z');

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [msg] = postSpy.mock.calls[0];
    expect(msg.type).toBe('error');
    expect(msg.featureId).toBe('selector-req-2');
  });

  it('resolves |Z on faces to both horizontal faces (top + bottom)', () => {
    const ctx = mockCtx();
    ctx.shapeStorage.set('body-1', boxShape());

    handleResolveSelector(ctx, 'req-3', 'body-1', 'face', '|Z');

    const [msg] = postSpy.mock.calls[0];
    const indices = msg.refs.map((r: any) => r.index).sort();
    expect(indices).toEqual([0, 1]);
  });
});
