import { SketchConstraint } from '../SketchConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

export interface VerticalConstraint extends SketchConstraint {
  type: SketchConstraintType.VERTICAL;
  /** The ID of the SketchLine that is constrained to be vertical */
  lineId: string;
}
