import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

export interface SketchPolygon {
  type: SketchElementType.POLYGON;
  id: string;
  points: Point2D[];
}
