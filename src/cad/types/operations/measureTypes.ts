import type { Point3D } from '../geometry/primitives';
import type { SubShapeKind } from '../geometry/shapeRefs';

export enum MeasureType {
  DISTANCE = 'distance',
  ANGLE = 'angle',
  AREA = 'area',
  VOLUME = 'volume',
}

export interface MeasureParams {
  type: MeasureType;
  /** Entity IDs to measure (faces, edges, vertices) */
  entities: string[];
}

/** One picked sub-shape (face/edge/vertex) by ordinal index in a body. */
export interface MeasureSelection {
  kind: SubShapeKind;
  index: number;
}

/**
 * Distance (and, when both selections are directional and non-parallel, the
 * angle) between two picked sub-shapes (ROADMAP §4 Measure distance/length).
 */
export interface MeasureBetweenData {
  /** Minimum distance between the two selections, in model units (mm). */
  distance: number;
  /** Closest point on the first selection (min-distance solution). */
  pointA: Point3D;
  /** Closest point on the second selection. */
  pointB: Point3D;
  /**
   * Acute angle in degrees between the two selections' directions (edge
   * tangent / planar-face normal). Present only when both selections are
   * directional and not (anti)parallel.
   */
  angle?: number;
}

/**
 * The six unique components of a symmetric 3×3 matrix of inertia, taken about
 * the coordinate origin in model space. Position- and orientation-sensitive:
 * two solids of identical volume/bbox but different material distribution
 * (e.g. a fillet on the wrong edge) have different inertia tensors.
 */
export interface InertiaTensor {
  xx: number;
  yy: number;
  zz: number;
  xy: number;
  xz: number;
  yz: number;
}

/** Volume + bounding-box readout of a body (ROADMAP §4 Measurement / Analysis). */
export interface MeasurementData {
  /** Enclosed volume in model units³ (mm³). */
  volume: number;
  /** Axis-aligned bounding box: min/max corners and per-axis size. */
  boundingBox: {
    min: Point3D;
    max: Point3D;
    /** Per-axis extent (max − min): the box's width × height × depth. */
    size: Point3D;
  };
  /**
   * Centre of mass in model space. Optional so legacy readouts still type-check;
   * `measureShape` always populates it. Position-sensitive — shifts when
   * material is removed from a different location.
   */
  centreOfMass?: Point3D;
  /**
   * Matrix of inertia about the origin. Optional for the same reason as
   * `centreOfMass`; always populated by `measureShape`. Together with
   * `centreOfMass` this is what makes the measure hash catch same-volume
   * regressions the scalar readouts miss.
   */
  inertia?: InertiaTensor;
}

export enum EvaluateOperation {
  MEASURE = 'measure'
}
