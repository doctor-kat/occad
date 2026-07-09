import { SubShapeKind } from './Fingerprint';
import type { Fingerprint } from './Fingerprint';

/** A selection reference that resolves by fingerprint, falling back to index. */
export interface StableRef {
  kind: SubShapeKind;
  /** Ordinal index captured at selection time (fallback). */
  index: number;
  /** Geometric fingerprint captured at selection time (primary). */
  fingerprint?: Fingerprint;
}
