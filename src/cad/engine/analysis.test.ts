import { describe, it, expect } from "vitest";
import { measureShape } from "./analysis";
import type { WorkerContext } from "./workerContext";

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
