import { SketchLine } from './SketchLine';
import { SketchCircle } from './SketchCircle';
import { SketchArc } from './SketchArc';
import { SketchRectangle } from './SketchRectangle';
import { SketchPolygon } from './SketchPolygon';
import { SketchEllipse } from './SketchEllipse';
import { SketchSpline } from './SketchSpline';
import { SketchBezier } from './SketchBezier';

export type SketchElement =
  | SketchLine
  | SketchCircle
  | SketchArc
  | SketchRectangle
  | SketchPolygon
  | SketchEllipse
  | SketchSpline
  | SketchBezier;
