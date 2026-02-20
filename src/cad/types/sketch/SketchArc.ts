import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

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
