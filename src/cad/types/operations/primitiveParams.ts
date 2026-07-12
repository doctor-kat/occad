import { Point3D } from '../geometry/primitives';

export interface PrimitiveBoxParams {
  width: number;
  height: number;
  depth: number;
  center?: Point3D;
}

export interface PrimitiveSphereParams {
  radius: number;
  center?: Point3D;
}

export interface PrimitiveCylinderParams {
  radius: number;
  height: number;
  center?: Point3D;
}

export interface PrimitiveConeParams {
  radius1: number;
  radius2: number;
  height: number;
  center?: Point3D;
}

export interface PrimitiveTorusParams {
  majorRadius: number;
  minorRadius: number;
  center?: Point3D;
}

export interface PrimitiveWedgeParams {
  width: number;
  height: number;
  depth: number;
  ltx: number;
  center?: Point3D;
}
