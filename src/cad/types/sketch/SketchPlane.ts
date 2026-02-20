import { Point3D } from '../geometry/Point3D';
import { Vector3D } from '../geometry/Vector3D';

export enum PlaneType {
  XY = 'xy',
  YZ = 'yz',
  XZ = 'xz',
  FACE = 'face',
  CUSTOM = 'custom'
}

/** Sketch plane definition */
export interface SketchPlane {
  /** Reference plane ID or face reference */
  planeRef: string;
  /** Plane type */
  type: PlaneType;
  /** For custom planes - origin and normal */
  origin?: Point3D;
  normal?: Vector3D;
  /** Offset from reference plane */
  offset?: number;
}
