/**
 * measureShape operation (ROADMAP §4)
 *
 * Computes mass/volume and bounding-box properties of a solid using the OCCT
 * global-property tools that ship in `opencascade.full.wasm`:
 *   - Volume        → `BRepGProp.VolumeProperties` → `GProp_GProps.Mass()`
 *   - Bounding box  → `BRepBndLib.Add` into a `Bnd_Box`, then `Get`
 *
 * Kept UI-agnostic: returns plain numbers the main thread formats for display.
 */

type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import type { MeasurementData } from '@/cad/types';

/**
 * Measure a shape's volume and axis-aligned bounding box.
 * Volume is in model units³ (mm³ here); the bounding box is the min/max corners
 * of the tightest axis-aligned box containing the shape.
 */
export function measureShape(ctx: WorkerContext, shape: TopoDS_Shape): MeasurementData {
  return {
    volume: computeVolume(ctx, shape),
    boundingBox: computeBoundingBox(ctx, shape),
  };
}

/** Volume via `BRepGProp.VolumeProperties` — `Mass()` is the enclosed volume. */
function computeVolume(ctx: WorkerContext, shape: TopoDS_Shape): number {
  const { oc } = ctx;
  const props = new oc.GProp_GProps_1();
  try {
    // VolumeProperties_1(shape, props, onlyClosed, skipShared, useTriangulation)
    oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
    return props.Mass();
  } finally {
    props.delete();
  }
}

/**
 * Axis-aligned bounding box via `BRepBndLib.Add` → `Bnd_Box`. `CornerMin`/
 * `CornerMax` return `gp_Pnt` corners (cleaner than the out-param `Get`, which
 * embind does not surface reliably).
 */
function computeBoundingBox(ctx: WorkerContext, shape: TopoDS_Shape): MeasurementData['boundingBox'] {
  const { oc } = ctx;
  const box = new oc.Bnd_Box_1();
  try {
    oc.BRepBndLib.Add(shape, box, false);
    const lo = box.CornerMin();
    const hi = box.CornerMax();
    const min = { x: lo.X(), y: lo.Y(), z: lo.Z() };
    const max = { x: hi.X(), y: hi.Y(), z: hi.Z() };
    lo.delete();
    hi.delete();
    return {
      min,
      max,
      size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    };
  } finally {
    box.delete();
  }
}
