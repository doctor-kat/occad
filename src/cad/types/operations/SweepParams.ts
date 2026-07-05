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
