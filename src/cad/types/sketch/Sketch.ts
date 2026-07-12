import { ShapeReference } from '../geometry/shapeRefs';
import { Workplane } from './Workplane';
import { SketchElement } from './SketchElement';
import type { SketchPrimitive } from './SketchPrimitive';
import type { SketchVisualMetadata } from './SketchVisualMetadata';

/** Per-sketch edge vertex data for wireframe rendering */
export interface SketchEdgeData {
  edgeVertices: Float32Array;
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
