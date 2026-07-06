import type { Point3D } from '../geometry/Point3D';
import type { SubShapeKind } from '../geometry/Fingerprint';

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
