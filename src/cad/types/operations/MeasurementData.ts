import type { Point3D } from '../geometry/Point3D';

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
