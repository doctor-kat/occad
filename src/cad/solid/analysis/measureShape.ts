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
import type { MeasurementData, Point3D, InertiaTensor } from '@/cad/types';

/**
 * Measure a shape's volume and axis-aligned bounding box.
 * Volume is in model units³ (mm³ here); the bounding box is the min/max corners
 * of the tightest axis-aligned box containing the shape.
 */
export function measureShape(ctx: WorkerContext, shape: TopoDS_Shape): MeasurementData {
  const mass = computeMassProperties(ctx, shape);
  return {
    volume: mass.volume,
    boundingBox: computeBoundingBox(ctx, shape),
    centreOfMass: mass.centreOfMass,
    inertia: mass.inertia,
  };
}

/**
 * Volume, centre of mass, and matrix of inertia from a single
 * `BRepGProp.VolumeProperties` pass. `Mass()` is the enclosed volume;
 * `CentreOfMass()` and `MatrixOfInertia()` describe how that mass is
 * distributed. The distribution fields are position/orientation-sensitive, so
 * they distinguish solids that share a volume/bbox but differ in shape.
 */
function computeMassProperties(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
): { volume: number; centreOfMass: Point3D; inertia: InertiaTensor } {
  const { oc } = ctx;
  const props = new oc.GProp_GProps_1();
  try {
    // VolumeProperties_1(shape, props, onlyClosed, skipShared, useTriangulation)
    oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);

    const com = props.CentreOfMass();
    const centreOfMass: Point3D = { x: com.X(), y: com.Y(), z: com.Z() };
    com.delete();

    // gp_Mat is a symmetric 3x3; Value(row, col) is 1-indexed. Take the six
    // unique components (about the origin — the GProps default location).
    const mat = props.MatrixOfInertia();
    const inertia: InertiaTensor = {
      xx: mat.Value(1, 1),
      yy: mat.Value(2, 2),
      zz: mat.Value(3, 3),
      xy: mat.Value(1, 2),
      xz: mat.Value(1, 3),
      yz: mat.Value(2, 3),
    };
    mat.delete();

    return { volume: props.Mass(), centreOfMass, inertia };
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
