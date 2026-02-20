import { ShapeReference } from '../geometry/ShapeReference';
import { SketchElement } from './SketchElement';
import { SketchPlane } from './SketchPlane';

export interface Sketch {
  id: string;
  name: string;
  /** Sketch plane definition */
  plane: SketchPlane;
  /** 2D geometry elements in this sketch */
  elements: SketchElement[];
  /** Reference to the OpenCascade wire/face generated from this sketch */
  geometry?: ShapeReference;
  /** Whether the sketch is closed (can be used for extrude/revolve) */
  isClosed: boolean;
  /** Whether this sketch is visible in the viewport */
  isVisible: boolean;
  createdAt: number;
  updatedAt: number;
}
