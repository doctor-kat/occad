import { SketchConstraint } from '../SketchConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

export interface FixedConstraint extends SketchConstraint {
  type: SketchConstraintType.FIXED;
  /** The ID of the SketchPoint that is fixed */
  pointId: string;
}
