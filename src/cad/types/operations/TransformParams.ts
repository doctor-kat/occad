import { Vector3D } from '../geometry/Vector3D';
import { Point3D } from '../geometry/Point3D';
import { Axis } from '../geometry/Axis';
import { TransformOperation } from './TransformOperation';

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
