import { DistanceConstraint } from './DistanceConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

describe('DistanceConstraint', () => {
  it('should create a DistanceConstraint with the correct properties', () => {
    const distanceConstraint: DistanceConstraint = {
      id: 'dist1',
      type: SketchConstraintType.DISTANCE,
      point1Id: 'pointX',
      point2Id: 'pointY',
      distance: 100,
    };

    expect(distanceConstraint.id).toBe('dist1');
    expect(distanceConstraint.type).toBe(SketchConstraintType.DISTANCE);
    expect(distanceConstraint.point1Id).toBe('pointX');
    expect(distanceConstraint.point2Id).toBe('pointY');
    expect(distanceConstraint.distance).toBe(100);
  });
});
