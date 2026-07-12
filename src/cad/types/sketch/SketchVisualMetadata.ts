import { Point2D } from '../geometry/primitives';

export interface SketchVisualMetadata {
  /** User-dragged label offset in 2D sketch units */
  labelOffset?: Point2D;
  /** Whole-dimension arrow style: swap both arrows together between pointing inward
   *  (default, tips at the witness lines, chevrons opening toward the interior) and
   *  outward (chevrons mirrored to open away from the interior) — the standard CAD
   *  toggle for tight dimensions where arrows don't fit inside. */
  arrowFlip?: boolean;
  /** Whether this is a driving dimension */
  isDriving: boolean;
  /** Selection state for UI */
  selectionState?: 'selected' | 'none';
  /** Solver state for the constraint */
  conflictState?: 'none' | 'conflicting' | 'redundant';
}
