import type { SubShapeKind } from '@/cad/types';
import type { Vec3 } from './Vec3';

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
