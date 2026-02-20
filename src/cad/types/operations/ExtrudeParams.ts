import { Vector3D } from '../geometry/Vector3D';

export interface ExtrudeParams {
  /** Distance to extrude (can be negative for opposite direction) */
  distance: number;
  /** Direction vector (optional, defaults to sketch plane normal) */
  direction?: Vector3D;
  /** Draft angle in degrees (0 = straight extrusion) */
  draftAngle?: number;
  /** Whether this is a boss (adds material) or cut (removes material) */
  isCut: boolean;
}
