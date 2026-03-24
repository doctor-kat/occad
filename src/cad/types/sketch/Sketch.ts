import { ShapeReference } from '../geometry/ShapeReference';
import { Workplane } from './Workplane';
import { Point2D } from '../geometry/Point2D';
import { SketchElement } from './SketchElement';

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
  /** Source OCC history tag if external */
  sourceId?: string;
}

export interface SketchVisualMetadata {
  /** User-dragged label offset in 2D sketch units */
  labelOffset?: Point2D;
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
}
