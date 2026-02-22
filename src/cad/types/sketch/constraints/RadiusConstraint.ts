import { SketchConstraint } from '../SketchConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

export interface RadiusConstraint extends SketchConstraint {
  type: SketchConstraintType.RADIUS;
  /** The ID of the SketchCircle or SketchArc involved in the radius constraint */
  elementId: string; // Can be Circle or Arc
  /** The desired radius */
  radius: number;
}
