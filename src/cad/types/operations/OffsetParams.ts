import { GeometryRef } from '../geometry/GeometryRef';

export interface OffsetParams {
  /** Distance to offset (positive for outward, negative for inward) */
  distance: number;
  /** Face references to offset (legacy `face-N` string or a fingerprinted StableRef; empty = all faces) */
  faces: GeometryRef[];
}
