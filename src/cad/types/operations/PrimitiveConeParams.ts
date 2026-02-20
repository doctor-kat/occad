import { Point3D } from '../geometry/Point3D';

export interface PrimitiveConeParams {
  radius1: number;
  radius2: number;
  height: number;
  center?: Point3D;
}
