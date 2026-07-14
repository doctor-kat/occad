import { describe, it, expect } from "vitest";
import { resolveExtrudeDirection, getPlanarFaceNormal, buildPrimitiveShape } from "./operations";
import { FeatureOperation } from "@/cad/types";
import type {
  ExtrudeParams,
  PrimitiveBoxParams,
  PrimitiveCylinderParams,
  PrimitiveSphereParams,
  PrimitiveConeParams,
  PrimitiveTorusParams,
  PrimitiveWedgeParams,
} from "@/cad/types";

/**
 * Build a fake OpenCascade context whose planar faces report `normal` as their
 * surface axis direction. This lets us exercise the extrude-direction logic
 * (which used to be hardcoded to world +Z) without loading the WASM kernel.
 *
 * Pass `normal: null` to simulate a non-planar surface / extraction failure.
 */
function mockCtx(normal: { x: number; y: number; z: number } | null) {
  const oc = {
    TopoDS: { Face_1: (f: any) => f },
    BRep_Tool: { Surface_2: (_f: any) => ({ get: () => ({}) }) },
    Handle_Geom_Plane_2: class {
      constructor(_surface: any) {}
      get() {
        if (!normal) return null;
        return {
          Axis: () => ({
            Direction: () => ({
              X: () => normal.x,
              Y: () => normal.y,
              Z: () => normal.z,
            }),
          }),
        };
      }
    },
  };
  return { oc } as any;
}

const FACE = { __isFace: true };

describe("getPlanarFaceNormal", () => {
  it("returns the surface axis direction for a planar face", () => {
    const n = getPlanarFaceNormal(mockCtx({ x: 0, y: 1, z: 0 }), FACE);
    expect(n).toEqual({ x: 0, y: 1, z: 0 });
  });

  it("returns null when the plane handle is null (non-planar surface)", () => {
    expect(getPlanarFaceNormal(mockCtx(null), FACE)).toBeNull();
  });
});

describe("resolveExtrudeDirection", () => {
  const params: ExtrudeParams = { distance: 10, isCut: false } as ExtrudeParams;

  // Regression: extruding a sketch on the Top Plane (XZ, normal +Y) used to
  // default to world +Z, which lies *in* the face plane and produced a flat,
  // zero-volume prism. The direction must follow the face's own normal.
  it("defaults to the face normal for an XZ (Top Plane) sketch — +Y", () => {
    const dir = resolveExtrudeDirection(mockCtx({ x: 0, y: 1, z: 0 }), FACE, params);
    expect(dir).toEqual({ x: 0, y: 1, z: 0 });
  });

  it("defaults to the face normal for a YZ (Right Plane) sketch — +X", () => {
    const dir = resolveExtrudeDirection(mockCtx({ x: 1, y: 0, z: 0 }), FACE, params);
    expect(dir).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("defaults to the face normal for an XY (Front Plane) sketch — +Z", () => {
    const dir = resolveExtrudeDirection(mockCtx({ x: 0, y: 0, z: 1 }), FACE, params);
    expect(dir).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("honors an explicit params.direction over the face normal", () => {
    const explicit: ExtrudeParams = {
      distance: 10,
      isCut: false,
      direction: { x: 0, y: 0, z: 1 },
    } as ExtrudeParams;
    const dir = resolveExtrudeDirection(mockCtx({ x: 0, y: 1, z: 0 }), FACE, explicit);
    expect(dir).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("falls back to world +Z when the face normal cannot be derived", () => {
    const dir = resolveExtrudeDirection(mockCtx(null), FACE, params);
    expect(dir).toEqual({ x: 0, y: 0, z: 1 });
  });
});

/**
 * Mock OCC kernel that records which primitive constructor was invoked and with
 * what arguments, so `buildPrimitiveShape`'s type→constructor dispatch can be
 * verified without loading the WASM kernel. Each `Make*` returns a fake maker
 * whose `Shape()` yields a tagged, non-null shape object.
 */
function mockPrimitiveCtx() {
  const calls: { ctor: string; args: any[] }[] = [];
  const makeShape = (tag: string) => ({ tag, IsNull: () => false });
  function maker(ctor: string, ...args: any[]) {
    calls.push({ ctor, args });
    return { Shape: () => makeShape(ctor), IsDone: () => true, delete() {} };
  }
  const oc: any = {
    calls,
    gp_Pnt_3: class { constructor(public x: number, public y: number, public z: number) {} delete() {} },
    gp_Vec_4: class { constructor(public x: number, public y: number, public z: number) {} delete() {} },
    gp_Trsf_1: class { SetTranslation_1() {} delete() {} },
    BRepBuilderAPI_Transform_2: class {
      constructor(public shape: any) {}
      IsDone() { return true; }
      Shape() { return { tag: "moved", inner: this.shape, IsNull: () => false }; }
      delete() {}
    },
    BRepPrimAPI_MakeBox_2: class { constructor(...a: any[]) { return maker("MakeBox_2", ...a); } },
    BRepPrimAPI_MakeCylinder_1: class { constructor(...a: any[]) { return maker("MakeCylinder_1", ...a); } },
    BRepPrimAPI_MakeSphere_1: class { constructor(...a: any[]) { return maker("MakeSphere_1", ...a); } },
    BRepPrimAPI_MakeCone_1: class { constructor(...a: any[]) { return maker("MakeCone_1", ...a); } },
    BRepPrimAPI_MakeTorus_1: class { constructor(...a: any[]) { return maker("MakeTorus_1", ...a); } },
    BRepPrimAPI_MakeWedge_1: class { constructor(...a: any[]) { return maker("MakeWedge_1", ...a); } },
  };
  return { oc } as any;
}

describe("buildPrimitiveShape", () => {
  it("dispatches Box to MakeBox_2 with (w, h, d)", () => {
    const ctx = mockPrimitiveCtx();
    const params: PrimitiveBoxParams = { width: 1, height: 2, depth: 3 };
    const shape = buildPrimitiveShape(ctx, FeatureOperation.BOX, params);
    expect(shape).toBeTruthy();
    expect(ctx.oc.calls[0]).toEqual({ ctor: "MakeBox_2", args: [1, 2, 3] });
  });

  it("dispatches Cylinder to MakeCylinder_1 with (r, h)", () => {
    const ctx = mockPrimitiveCtx();
    const params: PrimitiveCylinderParams = { radius: 4, height: 5 };
    buildPrimitiveShape(ctx, FeatureOperation.CYLINDER, params);
    expect(ctx.oc.calls[0]).toEqual({ ctor: "MakeCylinder_1", args: [4, 5] });
  });

  it("dispatches Sphere to MakeSphere_1 with (r)", () => {
    const ctx = mockPrimitiveCtx();
    const params: PrimitiveSphereParams = { radius: 7 };
    buildPrimitiveShape(ctx, FeatureOperation.SPHERE, params);
    expect(ctx.oc.calls[0]).toEqual({ ctor: "MakeSphere_1", args: [7] });
  });

  it("dispatches Cone to MakeCone_1 with (r1, r2, h)", () => {
    const ctx = mockPrimitiveCtx();
    const params: PrimitiveConeParams = { radius1: 3, radius2: 1, height: 6 };
    buildPrimitiveShape(ctx, FeatureOperation.CONE, params);
    expect(ctx.oc.calls[0]).toEqual({ ctor: "MakeCone_1", args: [3, 1, 6] });
  });

  it("dispatches Torus to MakeTorus_1 with (major, minor)", () => {
    const ctx = mockPrimitiveCtx();
    const params: PrimitiveTorusParams = { majorRadius: 10, minorRadius: 2 };
    buildPrimitiveShape(ctx, FeatureOperation.TORUS, params);
    expect(ctx.oc.calls[0]).toEqual({ ctor: "MakeTorus_1", args: [10, 2] });
  });

  it("dispatches Wedge to MakeWedge_1 with (w, h, d, ltx)", () => {
    const ctx = mockPrimitiveCtx();
    const params: PrimitiveWedgeParams = { width: 2, height: 3, depth: 4, ltx: 1 };
    buildPrimitiveShape(ctx, FeatureOperation.WEDGE, params);
    expect(ctx.oc.calls[0]).toEqual({ ctor: "MakeWedge_1", args: [2, 3, 4, 1] });
  });

  it("builds at the origin when center is zero/absent (no transform)", () => {
    const ctx = mockPrimitiveCtx();
    buildPrimitiveShape(ctx, FeatureOperation.SPHERE, { radius: 1, center: { x: 0, y: 0, z: 0 } });
    expect(ctx.oc.calls.map((c: any) => c.ctor)).not.toContain("MakeBox_2");
    // Only the sphere maker ran — no translate transform recorded via calls,
    // and the returned shape is the raw sphere (not a "moved" wrapper).
    const shape = buildPrimitiveShape(ctx, FeatureOperation.SPHERE, { radius: 1 });
    expect(shape.tag).toBe("MakeSphere_1");
  });

  it("translates the primitive to a non-zero center", () => {
    const ctx = mockPrimitiveCtx();
    const shape = buildPrimitiveShape(ctx, FeatureOperation.SPHERE, {
      radius: 1,
      center: { x: 5, y: 0, z: 0 },
    });
    // Wrapped by the BRepBuilderAPI_Transform mock.
    expect(shape.tag).toBe("moved");
    expect(shape.inner.tag).toBe("MakeSphere_1");
  });

  it("returns null for a non-primitive feature type", () => {
    const ctx = mockPrimitiveCtx();
    expect(buildPrimitiveShape(ctx, FeatureOperation.FILLET, {} as any)).toBeNull();
  });
});
