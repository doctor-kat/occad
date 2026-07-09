/**
 * Stable geometry-reference types shared by the engine, worker DTOs, and feature
 * params. The actual fingerprint *computation* lives in the worker
 * (`src/cad/engine/fingerprint.ts`); these are the serializable shapes that get
 * stored in `CADProject` and passed across the worker boundary.
 *
 * Background: selections were historically stored as bare `edge-N` / `face-N`
 * strings — ordinal indices that renumber on every topology change. A
 * `StableRef` additionally carries a geometric `Fingerprint`, so a selection can
 * be re-found by geometry after an edit shuffles the indices. See the
 * "Deterministic topology & stable selections" section in `ROADMAP.md`.
 */

import type { SubShapeKind } from './SubShapeKind';

export interface Fingerprint {
  kind: SubShapeKind;
  /** Ordinal index in the body's sub-shape map at capture time (fallback only). */
  index: number;
  /**
   * Geometric type tag: faces -> 'plane'|'cylinder'|'cone'|'sphere'|'torus'|
   * 'bspline'|'other'; edges -> 'line'|'circle'|'ellipse'|'bspline'|'other'.
   */
  geomType: string;
  /** Area for faces, length for edges (GProp Mass). */
  measure: number;
  /** Center of mass in world coordinates. */
  centroid: { x: number; y: number; z: number };
  /** Oriented-bounding-box half-sizes, sorted ascending (rotation invariant). */
  obb: [number, number, number];
}

import type { StableRef } from './StableRef';
import type { GeometryRef } from './GeometryRef';

/** Parse a legacy `edge-N` / `face-N` / `vertex-N` string into a (fingerprint-less) StableRef. */
export function parseRefString(ref: string): StableRef | null {
  const m = ref.match(/^(edge|face|vertex)-(\d+)$/);
  if (!m) return null;
  return { kind: m[1] as SubShapeKind, index: Number(m[2]) };
}

/** Normalize any GeometryRef to a StableRef, or null if it is malformed. */
export function toStableRef(ref: GeometryRef): StableRef | null {
  return typeof ref === 'string' ? parseRefString(ref) : ref;
}

/**
 * Parse the trailing integer from a geometry reference such as `edge-3` or
 * `face-0`. Returns NaN when the ref has no numeric suffix.
 */
export function parseGeometryIndex(ref: string): number {
  const suffix = ref.slice(ref.lastIndexOf('-') + 1);
  if (suffix === '' || !/^\d+$/.test(suffix)) return NaN;
  return Number(suffix);
}

/** Human-readable label for a ref (for error messages / UI display). */
export function refLabel(ref: GeometryRef): string {
  return typeof ref === 'string' ? ref : `${ref.kind}-${ref.index}`;
}

/** True if the ref already carries a fingerprint (i.e. has been captured). */
export function hasFingerprint(ref: GeometryRef): boolean {
  return typeof ref !== 'string' && !!ref.fingerprint;
}

