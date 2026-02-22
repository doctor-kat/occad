import { SketchConstraint } from '../SketchConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

export interface HorizontalConstraint extends SketchConstraint {
  type: SketchConstraintType.HORIZONTAL;
  /** The ID of the SketchLine that is constrained to be horizontal */
  lineId: string;
}
