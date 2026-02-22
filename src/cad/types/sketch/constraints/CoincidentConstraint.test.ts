import { CoincidentConstraint } from './CoincidentConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

describe('CoincidentConstraint', () => {
  it('should create a CoincidentConstraint with the correct properties', () => {
    const coincidentConstraint: CoincidentConstraint = {
      id: 'coincident1',
      type: SketchConstraintType.COINCIDENT,
      point1Id: 'point1',
      point2Id: 'point2',
    };

    expect(coincidentConstraint.id).toBe('coincident1');
    expect(coincidentConstraint.type).toBe(SketchConstraintType.COINCIDENT);
    expect(coincidentConstraint.point1Id).toBe('point1');
    expect(coincidentConstraint.point2Id).toBe('point2');
  });
});
