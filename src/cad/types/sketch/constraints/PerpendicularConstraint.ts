import { SketchConstraint } from '../SketchConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

export interface PerpendicularConstraint extends SketchConstraint {
  type: SketchConstraintType.PERPENDICULAR;
  /** The ID of the first SketchLine involved in the perpendicular constraint */
  line1Id: string;
  /** The ID of the second SketchLine involved in the perpendicular constraint */
  line2Id: string;
}
