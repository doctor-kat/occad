import { GeometryRef } from '../geometry/Fingerprint';

export interface ChamferParams {
  /** Distance of the chamfer */
  distance: number;
  /** Edge references to chamfer (legacy `edge-N` string or a fingerprinted StableRef) */
  edges: GeometryRef[];
  /** Optional selector rule (ROADMAP §9.1 Phase 4), re-evaluated live each rebuild and unioned with `edges`. */
  selector?: string;
}
