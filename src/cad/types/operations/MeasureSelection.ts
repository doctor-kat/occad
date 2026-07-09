import type { SubShapeKind } from '../geometry/Fingerprint';

/** One picked sub-shape (face/edge/vertex) by ordinal index in a body. */
export interface MeasureSelection {
  kind: SubShapeKind;
  index: number;
}
