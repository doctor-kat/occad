import { Point2D } from '../geometry/primitives';

export enum SketchElementType {
  LINE = 'line',
  CIRCLE = 'circle',
  ARC = 'arc',
  RECTANGLE = 'rectangle',
  POLYGON = 'polygon',
  ELLIPSE = 'ellipse',
  BEZIER = 'bezier',
  POINT = 'point'
}

export interface SketchLine {
  type: SketchElementType.LINE;
  id: string;
  start: Point2D;
  end: Point2D;
  /**
   * Construction geometry (e.g. a centerline): drawn and snappable in the sketch
   * but excluded from the solid profile, so it never reaches the OCC wire.
   */
  construction?: boolean;
}

export interface SketchCircle {
  type: SketchElementType.CIRCLE;
  id: string;
  center: Point2D;
  radius: number;
}

export interface SketchArc {
  type: SketchElementType.ARC;
  id: string;
  /** Three points defining the arc (start, mid, end) or center-based definition */
  points?: [Point2D, Point2D, Point2D];
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface SketchRectangle {
  type: SketchElementType.RECTANGLE;
  id: string;
  corner1: Point2D;
  corner2: Point2D;
}

export interface SketchPolygon {
  type: SketchElementType.POLYGON;
  id: string;
  points: Point2D[];
}

export interface SketchEllipse {
  type: SketchElementType.ELLIPSE;
  id: string;
  center: Point2D;
  majorRadius: number;
  minorRadius: number;
  rotation: number; // angle in radians
}

export interface SketchBezier {
  type: SketchElementType.BEZIER;
  id: string;
  controlPoints: Point2D[];
}

export interface SketchPoint {
  type: SketchElementType.POINT;
  id: string;
  x: number;
  y: number;
}
