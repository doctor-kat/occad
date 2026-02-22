import { FixedConstraint } from './FixedConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

describe('FixedConstraint', () => {
  it('should create a FixedConstraint with the correct properties', () => {
    const fixedConstraint: FixedConstraint = {
      id: 'fixed1',
      type: SketchConstraintType.FIXED,
      pointId: 'point1',
    };

    expect(fixedConstraint.id).toBe('fixed1');
    expect(fixedConstraint.type).toBe(SketchConstraintType.FIXED);
    expect(fixedConstraint.pointId).toBe('point1');
  });
});
