import { Point3D } from '../geometry/Point3D';

export interface PrimitiveBoxParams {
  width: number;
  height: number;
  depth: number;
  center?: Point3D;
}
