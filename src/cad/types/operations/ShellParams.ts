import { GeometryRef } from '../geometry/GeometryRef';

export interface ShellParams {
  /** Thickness of the shell (positive for outward, negative for inward) */
  thickness: number;
  /** Face references to remove (legacy `face-N` string or a fingerprinted StableRef) */
  faces: GeometryRef[];
  /** Optional selector rule (ROADMAP §9.1 Phase 4), re-evaluated live each rebuild and unioned with `faces`. */
  selector?: string;
}
