import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

export interface SketchLine {
  type: SketchElementType.LINE;
  id: string;
  start: Point2D;
  end: Point2D;
}
