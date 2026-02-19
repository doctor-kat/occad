// ============================================================================
// Geometry & OpenCascade Types
// ============================================================================

/** 3D Point */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** 2D Point (for sketch geometry) */
export interface Point2D {
  x: number;
  y: number;
}

/** Vector for directions and extrusion */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/** Axis definition for revolve operations */
export interface Axis {
  origin: Point3D;
  direction: Vector3D;
}

/** Reference to OpenCascade shape in worker */
export interface ShapeReference {
  /** Unique ID for this shape in the worker */
  shapeId: string;
  /** Type of shape (solid, face, wire, edge) */
  shapeType: 'solid' | 'face' | 'wire' | 'edge' | 'vertex';
}
