import { GeometryRef } from '../geometry/shapeRefs';

export interface FilletParams {
  /** Radius of the fillet */
  radius: number;
  /** Edge references to fillet (legacy `edge-N` string or a fingerprinted StableRef) */
  edges: GeometryRef[];
  /**
   * Optional selector rule (ROADMAP §9.1 Phase 4), e.g. `|Z` for "all vertical
   * edges". Re-evaluated against the live body on every rebuild and unioned
   * with `edges`, so edges introduced by an upstream change are picked up
   * automatically instead of needing to be re-selected by hand.
   */
  selector?: string;
}

export interface ChamferParams {
  /** Distance of the chamfer */
  distance: number;
  /** Edge references to chamfer (legacy `edge-N` string or a fingerprinted StableRef) */
  edges: GeometryRef[];
  /** Optional selector rule (ROADMAP §9.1 Phase 4), re-evaluated live each rebuild and unioned with `edges`. */
  selector?: string;
}

export interface ShellParams {
  /** Thickness of the shell (positive for outward, negative for inward) */
  thickness: number;
  /** Face references to remove (legacy `face-N` string or a fingerprinted StableRef) */
  faces: GeometryRef[];
  /** Optional selector rule (ROADMAP §9.1 Phase 4), re-evaluated live each rebuild and unioned with `faces`. */
  selector?: string;
}

export interface OffsetParams {
  /** Distance to offset (positive for outward, negative for inward) */
  distance: number;
  /** Face references to offset (legacy `face-N` string or a fingerprinted StableRef; empty = all faces) */
  faces: GeometryRef[];
}
