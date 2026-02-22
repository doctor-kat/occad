import { PerpendicularConstraint } from './PerpendicularConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

describe('PerpendicularConstraint', () => {
  it('should create a PerpendicularConstraint with the correct properties', () => {
    const perpendicularConstraint: PerpendicularConstraint = {
      id: 'perp1',
      type: SketchConstraintType.PERPENDICULAR,
      line1Id: 'lineX',
      line2Id: 'lineY',
    };

    expect(perpendicularConstraint.id).toBe('perp1');
    expect(perpendicularConstraint.type).toBe(SketchConstraintType.PERPENDICULAR);
    expect(perpendicularConstraint.line1Id).toBe('lineX');
    expect(perpendicularConstraint.line2Id).toBe('lineY');
  });
});
