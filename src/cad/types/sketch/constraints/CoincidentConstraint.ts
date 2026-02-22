import { SketchConstraint } from '../SketchConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

export interface CoincidentConstraint extends SketchConstraint {
  type: SketchConstraintType.COINCIDENT;
  /** The ID of the first SketchPoint involved in the coincidence */
  point1Id: string;
  /** The ID of the second SketchPoint involved in the coincidence */
  point2Id: string;
}
