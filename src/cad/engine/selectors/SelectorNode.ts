import { Axis } from './types';
import type { Vec3 } from './Vec3';

/** Parsed selector AST. Produced by `grammar.parse`, consumed by `evaluate`. */
export type SelectorNode =
  /** `%plane`, `%line`, `%cylinder`, … — geometry-type filter. */
  | { kind: 'type'; geomType: string }
  /** `>Z` / `<Z` (max/min centroid along axis); `>Z[n]` = n-th group, 0-based. */
  | { kind: 'dirMinMax'; axis: Axis; max: boolean; nth?: number }
  /** `|Z` — direction parallel to the axis (edge tangent / face normal ∥ axis). */
  | { kind: 'parallel'; axis: Axis }
  /** `#Z` — direction perpendicular to the axis. */
  | { kind: 'perpendicular'; axis: Axis }
  /** `+Z` / `-Z` — direction parallel to AND pointing along ±axis. */
  | { kind: 'directed'; axis: Axis; positive: boolean }
  /** `radius(n)` — n-th distinct radius, smallest first (0-based). */
  | { kind: 'radiusNth'; nth: number; max: boolean }
  /** `near(x,y,z)` — single sub-shape whose centroid is nearest the point. */
  | { kind: 'near'; point: Vec3 }
  | { kind: 'and'; left: SelectorNode; right: SelectorNode }
  | { kind: 'or'; left: SelectorNode; right: SelectorNode }
  | { kind: 'not'; operand: SelectorNode };
