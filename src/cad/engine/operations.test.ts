import { describe, it, expect } from "vitest";
import { resolveExtrudeDirection, getPlanarFaceNormal } from "./operations";
import type { ExtrudeParams } from "@/cad/types";

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
