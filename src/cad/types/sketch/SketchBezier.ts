import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

export interface SketchBezier {
  type: SketchElementType.BEZIER;
  id: string;
  controlPoints: Point2D[];
}
