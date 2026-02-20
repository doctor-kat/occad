import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

export interface SketchRectangle {
  type: SketchElementType.RECTANGLE;
  id: string;
  corner1: Point2D;
  corner2: Point2D;
}
