import { SketchConstraint } from '../SketchConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

export interface ParallelConstraint extends SketchConstraint {
  type: SketchConstraintType.PARALLEL;
  /** The ID of the first SketchLine involved in the parallel constraint */
  line1Id: string;
  /** The ID of the second SketchLine involved in the parallel constraint */
  line2Id: string;
}
