import { SketchLine } from './SketchLine';
import { SketchCircle } from './SketchCircle';
import { SketchArc } from './SketchArc';
import { SketchRectangle } from './SketchRectangle';
import { SketchPolygon } from './SketchPolygon';
import { SketchEllipse } from './SketchEllipse';
import { SketchBezier } from './SketchBezier';
import { SketchPoint } from './SketchPoint';

export type SketchElement =
  | SketchLine
  | SketchCircle
  | SketchArc
  | SketchRectangle
  | SketchPolygon
  | SketchEllipse
  | SketchBezier
  | SketchPoint;
