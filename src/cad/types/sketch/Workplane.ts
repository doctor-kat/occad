import { Point3D, Vector3D } from '../geometry/primitives';

/**
 * Represents a coordinate system in 3D space, similar to OpenCascade's gp_Ax3.
 * Used for defining the local coordinate system of a sketch.
 */
export interface Workplane {
  /** Origin of the local coordinate system */
  origin: Point3D;
  /** Normal to the plane (Z-axis of the local system) */
  normal: Vector3D;
  /** X-axis of the local system */
  xAxis: Vector3D;
  /** Y-axis of the local system */
  yAxis: Vector3D;
}
