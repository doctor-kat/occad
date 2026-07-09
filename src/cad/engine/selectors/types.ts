/**
 * Selector system — shared types (ROADMAP §9.1, TODO.md).
 *
 * A clean-room port of CadQuery's *selector concept*: a small declarative DSL
 * (`>Z`, `|Z`, `%plane`, `>Z[1]`, `and`/`or`/`not`, …) that picks edges/faces by
 * geometry instead of by fragile ordinal index. This module holds only the
 * serializable/pure shapes; extraction from OCC lives in `describe.ts`, parsing
 * in `grammar.ts`, and matching in `evaluate.ts` — all pure and unit-testable.
 */

import type { SubShapeKind } from '@/cad/types';

export enum Axis {
  X = 'X',
  Y = 'Y',
  Z = 'Z',
}
export interface Vec3 { x: number; y: number; z: number }

/**
 * Everything a selector predicate needs about one sub-shape. Reuses the same
 * fields `fingerprint.ts` already extracts (geomType/measure/centroid/obb) plus
 * two selection-only additions — `direction` (face normal at its center / edge
 * tangent) and `radius` — that the persisted `Fingerprint` deliberately omits.
 * Worker-only; never serialized into `CADProject`.
 */
export interface SubShapeDescriptor {
  /** 0-based ordinal in the body's sub-shape map (the index a StableRef stores). */
  index: number;
  kind: SubShapeKind;
  /** faces: 'plane'|'cylinder'|'cone'|'sphere'|'torus'|'bspline'|'other';
   *  edges: 'line'|'circle'|'ellipse'|'bspline'|'other'. */
  geomType: string;
  /** Area for faces, length for edges. */
  measure: number;
  /** Center of mass, world coordinates. */
  centroid: Vec3;
  /** Oriented-bounding-box half-sizes, sorted ascending. */
  obb: [number, number, number];
  /** Face normal at its center / edge tangent direction (unit); absent when N/A. */
  direction?: Vec3;
  /** Cylinder/circle radius when the sub-shape has one. */
  radius?: number;
}

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
