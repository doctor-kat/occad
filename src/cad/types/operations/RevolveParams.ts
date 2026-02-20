import { Axis } from '../geometry/Axis';

export interface RevolveParams {
  /** Axis of revolution */
  axis: Axis;
  /** Angle in degrees (360 for full revolution) */
  angle: number;
  /** Whether this is a boss (adds material) or cut (removes material) */
  isCut: boolean;
}
