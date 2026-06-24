import { GeometryRef } from '../geometry/Fingerprint';

export interface ShellParams {
  /** Thickness of the shell (positive for outward, negative for inward) */
  thickness: number;
  /** Face references to remove (legacy `face-N` string or a fingerprinted StableRef) */
  faces: GeometryRef[];
}
