import { ShapeReference } from '../geometry/ShapeReference';
import { Workplane } from './Workplane';
import { Point2D } from '../geometry/Point2D';
import { SketchElement } from './SketchElement';
import { StableRef } from '../geometry/Fingerprint';

export type SketchPrimitiveType = 'point' | 'line' | 'circle' | 'arc' | 'ellipse';

export interface SketchPrimitive {
  id: string;
  type: SketchPrimitiveType;
  /** planegcs data (references point IDs, contains numerical values) */
  data: any;
  /** Whether this primitive is fixed in the solver */
  fixed: boolean;
  /** Whether this is external geometry projected from the solid */
  isExternal?: boolean;
  /** Source OCC tag if external — bare positional `edge-N`/`vertex-N`/`face-N` (fallback / dedup key) */
  sourceId?: string;
  /**
   * Geometry-anchored upgrade of `sourceId`, captured lazily by the worker during
   * rebuild (fingerprint + index). Preferred over `sourceId` when resolving the
   * external sub-shape, so it survives an upstream edit that renumbers the index
   * map. See `ROADMAP.md` (Deterministic topology).
   */
  sourceRef?: StableRef;
}

export interface SketchVisualMetadata {
  /** User-dragged label offset in 2D sketch units */
  labelOffset?: Point2D;
  /** Whole-dimension arrow style: swap both arrows together between pointing inward
   *  (default, tips at the witness lines, chevrons opening toward the interior) and
   *  outward (chevrons mirrored to open away from the interior) — the standard CAD
   *  toggle for tight dimensions where arrows don't fit inside. */
  arrowFlip?: boolean;
  /** Whether this is a driving dimension */
  isDriving: boolean;
  /** Selection state for UI */
  selectionState?: 'selected' | 'none';
  /** Solver state for the constraint */
  conflictState?: 'none' | 'conflicting' | 'redundant';
}

export interface Sketch {
  id: string;
  name: string;
  /** Coordinate system for the sketch */
  workplane: Workplane;
  /** planegcs primitives */
  primitives: SketchPrimitive[];
  /** Legacy sketch elements for input */
  elements: SketchElement[];
  /** planegcs constraint objects */
  constraints: any[];
  /** Visual metadata keyed by constraint ID */
  visualMetadata: Record<string, SketchVisualMetadata>;
  /** Reference to the generated OpenCascade shape (wire/face) */
  geometry?: ShapeReference;
  /** Degrees of freedom remaining in the sketch */
  dof?: number;
  /** Whether the sketch is closed and can be used for solid operations */
  isClosed: boolean;
  isVisible: boolean;
  createdAt: number;
  updatedAt: number;
  /**
   * Explicit build-order override (epoch-ms domain), mirroring `Feature.sequence`.
   * When unset, ordering falls back to `createdAt`. See `compareBuildOrder`.
   */
  sequence?: number;
}
