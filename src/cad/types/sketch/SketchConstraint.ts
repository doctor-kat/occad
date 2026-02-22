import { SketchConstraintType } from './SketchConstraintType';

export interface SketchConstraint {
  id: string;
  type: SketchConstraintType;
  /** References to the IDs of the sketch elements involved in the constraint */
  // The actual parameters will vary per constraint type, handled by specific interfaces
  // For example, FixedConstraint will reference a single SketchPoint's ID
  // CoincidentConstraint might reference two SketchPoint IDs
}
