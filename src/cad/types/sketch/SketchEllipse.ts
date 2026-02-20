import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

export interface SketchEllipse {
  type: SketchElementType.ELLIPSE;
  id: string;
  center: Point2D;
  majorRadius: number;
  minorRadius: number;
  rotation: number; // angle in radians
}
