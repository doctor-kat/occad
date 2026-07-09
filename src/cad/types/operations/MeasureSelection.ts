import type { SubShapeKind } from '../geometry/SubShapeKind';

/** One picked sub-shape (face/edge/vertex) by ordinal index in a body. */
export interface MeasureSelection {
  kind: SubShapeKind;
  index: number;
}
