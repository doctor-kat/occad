import { Point3D } from '../geometry/Point3D';

export interface PrimitiveWedgeParams {
  width: number;
  height: number;
  depth: number;
  ltx: number;
  center?: Point3D;
}
