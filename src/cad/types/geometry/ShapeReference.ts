import type { ShapeType } from './ShapeType';

/** Reference to OpenCascade shape in worker */
export interface ShapeReference {
  /** Unique ID for this shape in the worker */
  shapeId: string;
  /** Type of shape (solid, face, wire, edge) */
  shapeType: ShapeType;
}
