import { GeometryRef } from '../geometry/Fingerprint';

export interface FilletParams {
  /** Radius of the fillet */
  radius: number;
  /** Edge references to fillet (legacy `edge-N` string or a fingerprinted StableRef) */
  edges: GeometryRef[];
}
