import type { Point2D, Point3D, Vector3D } from './geometry';

// ============================================================================
// Sketch Geometry Types
// ============================================================================

export type SketchElementType = 'line' | 'circle' | 'arc' | 'rectangle' | 'polygon' | 'ellipse' | 'spline' | 'bezier';

export interface SketchLine {
  type: 'line';
  id: string;
  start: Point2D;
  end: Point2D;
}

export interface SketchCircle {
  type: 'circle';
  id: string;
  center: Point2D;
  radius: number;
}

export interface SketchArc {
  type: 'arc';
  id: string;
  /** Three points defining the arc (start, mid, end) or center-based definition */
  points?: [Point2D, Point2D, Point2D];
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface SketchRectangle {
  type: 'rectangle';
  id: string;
  corner1: Point2D;
  corner2: Point2D;
}

export interface SketchPolygon {
  type: 'polygon';
  id: string;
  points: Point2D[];
}

export interface SketchEllipse {
  type: 'ellipse';
  id: string;
  center: Point2D;
  majorRadius: number;
  minorRadius: number;
  rotation: number; // angle in radians
}

export interface SketchSpline {
  type: 'spline';
  id: string;
  points: Point2D[];
  degree?: number; // B-spline degree (default 3)
}

export interface SketchBezier {
  type: 'bezier';
  id: string;
  controlPoints: Point2D[];
}

export type SketchElement =
  | SketchLine
  | SketchCircle
  | SketchArc
  | SketchRectangle
  | SketchPolygon
  | SketchEllipse
  | SketchSpline
  | SketchBezier;

/** Sketch plane definition */
export interface SketchPlane {
  /** Reference plane ID or face reference */
  planeRef: string;
  /** Plane type */
  type: 'xy' | 'yz' | 'xz' | 'face' | 'custom';
  /** For custom planes - origin and normal */
  origin?: Point3D;
  normal?: Vector3D;
  /** Offset from reference plane */
  offset?: number;
}
