import { describe, it, expect } from 'vitest';
import { applyFillet, applyShell } from '@/cad/solid/modifications';
import type { FilletParams, ShellParams } from '@/cad/types';

/**
 * Persistent selector support (ROADMAP §9.1 Phase 4): `FilletParams.selector`/
 * `ShellParams.selector` are re-evaluated against the *live* body each call and
 * unioned with the explicit `edges`/`faces`. This mock extends the
 * fingerprint-aware fixture from `modifications.test.ts` with the extra OCC
 * surface `describeSubShapes` needs (orientation, Plane/Line direction).
 */
type Vec = { x: number; y: number; z: number };
type Geo = { id: string; g: string; m: number; c: Vec; h: [number, number, number]; n?: Vec; o?: 'fwd' | 'rev' };

const dir = (v?: Vec) => ({ X: () => v?.x ?? 0, Y: () => v?.y ?? 0, Z: () => v?.z ?? 0 });

function mockCtx(recorder: any = {}) {
  const oc: any = {
    TopAbs_ShapeEnum: { TopAbs_EDGE: 'EDGE', TopAbs_FACE: 'FACE' },
    TopAbs_Orientation: { TopAbs_FORWARD: 'FWD', TopAbs_REVERSED: 'REV' },
    TopExp: {
      MapShapes_1: (shape: any, kind: any, map: any) => {
        map._items = kind === 'EDGE' ? shape.__edges ?? [] : shape.__faces ?? [];
      },
    },
    TopTools_IndexedMapOfShape_1: class {
      _items: any[] = [];
      Extent() { return this._items.length; }
      FindKey(i: number) { return this._items[i - 1]; }
      delete() {}
    },
    TopoDS: { Edge_1: (s: any) => s, Face_1: (s: any) => s },
    GeomAbs_SurfaceType: { GeomAbs_Plane: 'plane', GeomAbs_Cylinder: 'cylinder' },
    GeomAbs_CurveType: { GeomAbs_Line: 'line', GeomAbs_Circle: 'circle' },
    BRepAdaptor_Surface_2: class {
      _g: Geo;
      constructor(f: Geo) { this._g = f; }
      GetType() { return this._g.g; }
      Plane() { return { Axis: () => ({ Direction: () => dir(this._g.n) }) }; }
      delete() {}
    },
    BRepAdaptor_Curve_2: class {
      _g: Geo;
      constructor(e: Geo) { this._g = e; }
      GetType() { return this._g.g; }
      Line() { return { Direction: () => dir(this._g.n) }; }
      delete() {}
    },
    GProp_GProps_1: class {
      _m = 0; _c = { x: 0, y: 0, z: 0 };
      Mass() { return this._m; }
      CentreOfMass() { const c = this._c; return { X: () => c.x, Y: () => c.y, Z: () => c.z, delete() {} }; }
      delete() {}
    },
    BRepGProp: {
      SurfaceProperties_1: (s: Geo, p: any) => { p._m = s.m; p._c = s.c; },
      LinearProperties: (s: Geo, p: any) => { p._m = s.m; p._c = s.c; },
    },
    Bnd_OBB_1: class {
      _h: [number, number, number] = [0, 0, 0];
      XHSize() { return this._h[0]; } YHSize() { return this._h[1]; } ZHSize() { return this._h[2]; }
      delete() {}
    },
    BRepBndLib: { AddOBB: (s: Geo, obb: any) => { obb._h = s.h; } },
    ChFi3d_FilletShape: { ChFi3d_Rational: 'rational' },
    BRepOffset_Mode: { BRepOffset_Skin: 'skin' },
    GeomAbs_JoinType: { GeomAbs_Arc: 'arc' },
    Message_ProgressRange_1: class { delete() {} },
    BRepFilletAPI_MakeFillet: class {
      constructor() { recorder.fillet = { adds: [] as any[] }; }
      Add_2(radius: number, edge: any) { recorder.fillet.adds.push({ radius, edge }); }
      Build() {}
      IsDone() { return true; }
      Shape() { return { filleted: true }; }
      delete() {}
    },
    BRepOffsetAPI_MakeThickSolid: class {
      constructor() { recorder.shell = { joinArgs: null }; }
      MakeThickSolidByJoin(...args: any[]) { recorder.shell.joinArgs = args; }
      IsDone() { return true; }
      Shape() { return { shelled: true }; }
      delete() {}
    },
    TopTools_ListOfShape_1: class {
      items: any[] = [];
      Append_1(s: any) { this.items.push(s); }
      delete() {}
    },
  };
  return { oc } as any;
}

const face = (id: string, m: number, c: Vec, h: [number, number, number], n?: Vec): Geo => ({
  id, g: 'plane', m, c, h, n,
  ...(({ Orientation_1: () => 'FWD' } as any)),
});
const edge = (id: string, m: number, c: Vec, h: [number, number, number], n?: Vec): Geo => ({ id, g: 'line', m, c, h, n });

/** Box: 6 faces (2 horizontal via +Z normal, 4 vertical walls) + 4 vertical edges. */
function boxBody() {
  return {
    __faces: [
      face('F-top', 100, { x: 5, y: 5, z: 10 }, [0, 5, 5], { x: 0, y: 0, z: 1 }),
      face('F-bottom', 100, { x: 5, y: 5, z: 0 }, [0, 5, 5], { x: 0, y: 0, z: 1 }),
      face('F-front', 80, { x: 5, y: 0, z: 5 }, [0, 4, 5], { x: 0, y: -1, z: 0 }),
    ],
    __edges: [
      edge('E-a', 10, { x: 0, y: 0, z: 5 }, [0, 0, 5], { x: 0, y: 0, z: 1 }),
      edge('E-b', 10, { x: 10, y: 0, z: 5 }, [0, 0, 5], { x: 0, y: 0, z: 1 }),
      edge('E-c', 10, { x: 5, y: 0, z: 0 }, [0, 5, 0], { x: 1, y: 0, z: 0 }), // horizontal, not |Z
    ],
  };
}

describe('applyFillet — persistent selector (ROADMAP §9.1 Phase 4)', () => {
  it('resolves edges purely from a selector when no explicit edges are given', () => {
    const rec: any = {};
    const params: FilletParams = { radius: 2, edges: [], selector: '|Z' };
    const result = applyFillet(mockCtx(rec), boxBody(), params);
    expect(result).toEqual({ filleted: true });
    expect(rec.fillet.adds.map((a: any) => a.edge.id).sort()).toEqual(['E-a', 'E-b']);
  });

  it('unions selector matches with explicit edges, deduped', () => {
    const rec: any = {};
    const params: FilletParams = { radius: 2, edges: ['edge-0'], selector: '|Z' }; // edge-0 = E-a, already matched
    applyFillet(mockCtx(rec), boxBody(), params);
    expect(rec.fillet.adds).toHaveLength(2); // E-a not duplicated, E-b added
    expect(rec.fillet.adds.map((a: any) => a.edge.id).sort()).toEqual(['E-a', 'E-b']);
  });

  it('does not require explicit edges when a selector is provided', () => {
    expect(() => applyFillet(mockCtx(), boxBody(), { radius: 2, edges: [], selector: '|Z' } as FilletParams)).not.toThrow();
  });
});

describe('applyShell — persistent selector', () => {
  it('resolves the top face via >Z and unions with explicit faces', () => {
    const rec: any = {};
    const params: ShellParams = { thickness: -2, faces: [], selector: '>Z' };
    const result = applyShell(mockCtx(rec), boxBody(), params);
    expect(result).toEqual({ shelled: true });
    expect(rec.shell.joinArgs[1].items.map((f: any) => f.id)).toEqual(['F-top']);
  });
});
