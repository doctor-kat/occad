import type { Fingerprint } from './Fingerprint';

export enum ShapeType {
  SOLID = 'solid',
  FACE = 'face',
  WIRE = 'wire',
  EDGE = 'edge',
  VERTEX = 'vertex'
}

/** Reference to OpenCascade shape in worker */
export interface ShapeReference {
  /** Unique ID for this shape in the worker */
  shapeId: string;
  /** Type of shape (solid, face, wire, edge) */
  shapeType: ShapeType;
}

export enum SubShapeKind {
  Edge = 'edge',
  Face = 'face',
  Vertex = 'vertex',
}

/** A selection reference that resolves by fingerprint, falling back to index. */
export interface StableRef {
  kind: SubShapeKind;
  /** Ordinal index captured at selection time (fallback). */
  index: number;
  /** Geometric fingerprint captured at selection time (primary). */
  fingerprint?: Fingerprint;
}

/**
 * A geometry selection reference as stored in feature params: either a legacy
 * `edge-N` / `face-N` string, or a richer {@link StableRef}. The worker resolver
 * accepts both, so persisted projects keep working without migration.
 */
export type GeometryRef = string | StableRef;
