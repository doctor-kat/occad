import { Point2D } from '../geometry/Point2D';
import { SketchElementType } from './SketchElementType';

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
