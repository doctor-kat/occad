import {
  SketchLine,
  SketchCircle,
  SketchArc,
  SketchRectangle,
  SketchPolygon,
  SketchEllipse,
  SketchBezier,
  SketchPoint,
} from './sketchElements';
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
