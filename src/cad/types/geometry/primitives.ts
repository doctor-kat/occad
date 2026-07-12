/** 2D Point (for sketch geometry) */
export interface Point2D {
  x: number;
  y: number;
  /** Optional: ID of the SketchPoint this Point2D might represent */
  id?: string;
}

/** 3D Point */
export interface Point3D {
  x: number;
  y: number;
  z: number;
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
