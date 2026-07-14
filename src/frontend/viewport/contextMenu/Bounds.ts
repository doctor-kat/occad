import type { Vec3 } from './Vec3';

export interface Bounds {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  /** Radius of the bounding sphere around `center`. */
  radius: number;
}
