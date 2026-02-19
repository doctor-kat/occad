import type { Point3D, Vector3D, Axis } from './geometry';

// ============================================================================
// Operation Parameter Types
// ============================================================================

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

export interface RevolveParams {
  /** Axis of revolution */
  axis: Axis;
  /** Angle in degrees (360 for full revolution) */
  angle: number;
  /** Whether this is a boss (adds material) or cut (removes material) */
  isCut: boolean;
}

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

export interface BooleanParams {
  /** IDs of features to combine */
  featureIds: string[];
  /** Operation type */
  operation: 'union' | 'intersect' | 'subtract';
}

export interface FilletParams {
  /** Radius of the fillet */
  radius: number;
  /** Edge references to fillet */
  edges: string[];
}

export interface ChamferParams {
  /** Distance of the chamfer */
  distance: number;
  /** Edge references to chamfer */
  edges: string[];
}

export type OperationParams =
  | ExtrudeParams
  | RevolveParams
  | PrimitiveBoxParams
  | PrimitiveSphereParams
  | PrimitiveCylinderParams
  | PrimitiveConeParams
  | PrimitiveTorusParams
  | BooleanParams
  | FilletParams
  | ChamferParams;
