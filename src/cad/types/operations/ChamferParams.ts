import { GeometryRef } from '../geometry/Fingerprint';

export interface ChamferParams {
  /** Distance of the chamfer */
  distance: number;
  /** Edge references to chamfer (legacy `edge-N` string or a fingerprinted StableRef) */
  edges: GeometryRef[];
}
