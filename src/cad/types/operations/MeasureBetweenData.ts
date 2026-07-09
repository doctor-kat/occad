import type { Point3D } from '../geometry/Point3D';

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
