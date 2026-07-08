import { SketchLine } from './SketchLine';
import { SketchCircle } from './SketchCircle';
import { SketchArc } from './SketchArc';
import { SketchRectangle } from './SketchRectangle';
import { SketchPolygon } from './SketchPolygon';
import { SketchEllipse } from './SketchEllipse';
import { SketchBezier } from './SketchBezier';
import { SketchPoint } from './SketchPoint';
import { SketchGroupMembership } from './SketchGroup';

/**
 * A drawable sketch entity. The `& SketchGroupMembership` intersection distributes
 * across the union — `(A | B) & C` becomes `(A & C) | (B & C)` — so each member keeps
 * its `type` discriminant while every element also carries the optional group fields.
 */
export type SketchElement = (
  | SketchLine
  | SketchCircle
  | SketchArc
  | SketchRectangle
  | SketchPolygon
  | SketchEllipse
  | SketchBezier
  | SketchPoint
) &
  SketchGroupMembership;
