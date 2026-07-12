import { Vector3D, Axis } from '../geometry/primitives';

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

/**
 * Sweep parameters: sweep a (closed) profile sketch along a path/spine sketch.
 * The profile is faced and swept along the path wire via BRepOffsetAPI_MakePipe.
 */
export interface SweepParams {
  /** Sketch id of the closed profile to sweep. */
  profileSketchId: string;
  /** Sketch id of the open (or closed) path/spine to sweep along. */
  pathSketchId: string;
  /** Whether this removes material (subtract) instead of adding it (union). */
  isCut?: boolean;
}

/**
 * Loft parameters: build a solid through a series of (closed) profile sketches.
 * The profiles are lofted in order via BRepOffsetAPI_ThruSections.
 */
export interface LoftParams {
  /** Ordered sketch ids of the profiles to loft through (2 or more). */
  sketchIds: string[];
  /** Straight (ruled) transitions between sections instead of smooth. */
  ruled?: boolean;
  /** Whether this removes material (subtract) instead of adding it (union). */
  isCut?: boolean;
}
