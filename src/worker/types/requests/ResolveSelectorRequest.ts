import type { SubShapeKind } from '@/cad/types';

/** Materialize a selector string (ROADMAP §9.1) against a body's sub-shapes. */
export interface ResolveSelectorRequest {
  type: 'resolveSelector';
  requestId: string;
  shapeId: string;
  kind: SubShapeKind;
  selector: string;
}
