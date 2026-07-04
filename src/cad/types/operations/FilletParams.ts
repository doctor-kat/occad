import { GeometryRef } from '../geometry/Fingerprint';

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
