import { Vector3D, Point3D, Axis } from '../geometry/primitives';

export enum TransformOperation {
  MOVE = 'move',
  ROTATE = 'rotate',
  MIRROR = 'mirror',
  SCALE = 'scale'
}

export interface TransformParams {
  type: TransformOperation;
  /** Translation vector for MOVE */
  translation?: Vector3D;
  /** Rotation axis and angle (degrees) for ROTATE */
  rotation?: {
    axis: Axis;
    angle: number;
  };
  /** Mirror plane (point and normal) for MIRROR */
  mirrorPlane?: Axis;
  /** Scale factor and center point for SCALE */
  scale?: {
    factor: number;
    center: Point3D;
  };
}
