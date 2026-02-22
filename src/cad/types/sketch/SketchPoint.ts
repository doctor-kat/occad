import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

export interface SketchPoint {
  type: SketchElementType.POINT;
  id: string;
  x: number;
  y: number;
}
