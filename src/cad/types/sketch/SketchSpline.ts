import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

export interface SketchSpline {
  type: SketchElementType.SPLINE;
  id: string;
  points: Point2D[];
  degree?: number; // B-spline degree (default 3)
}
