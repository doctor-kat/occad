export interface OffsetParams {
  /** Distance to offset (positive for outward, negative for inward) */
  distance: number;
  /** Face references to offset (if empty, offsets all faces) */
  faces: string[];
}
