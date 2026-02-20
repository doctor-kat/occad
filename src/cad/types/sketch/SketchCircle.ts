import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

export interface SketchCircle {
  type: SketchElementType.CIRCLE;
  id: string;
  center: Point2D;
  radius: number;
}
