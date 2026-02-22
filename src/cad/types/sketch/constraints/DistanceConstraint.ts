import { SketchConstraint } from '../SketchConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

export interface DistanceConstraint extends SketchConstraint {
  type: SketchConstraintType.DISTANCE;
  /** The ID of the first SketchPoint involved in the distance constraint */
  point1Id: string;
  /** The ID of the second SketchPoint involved in the distance constraint */
  point2Id: string;
  /** The desired distance between the two points */
  distance: number;
}
