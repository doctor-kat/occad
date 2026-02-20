import { Point3D } from './Point3D';
import { Vector3D } from './Vector3D';

/** Axis definition for revolve operations */
export interface Axis {
  origin: Point3D;
  direction: Vector3D;
}
