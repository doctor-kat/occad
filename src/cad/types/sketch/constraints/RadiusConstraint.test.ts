import { RadiusConstraint } from './RadiusConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

describe('RadiusConstraint', () => {
  it('should create a RadiusConstraint with the correct properties', () => {
    const radiusConstraint: RadiusConstraint = {
      id: 'r1',
      type: SketchConstraintType.RADIUS,
      elementId: 'circle1',
      radius: 25,
    };

    expect(radiusConstraint.id).toBe('r1');
    expect(radiusConstraint.type).toBe(SketchConstraintType.RADIUS);
    expect(radiusConstraint.elementId).toBe('circle1');
    expect(radiusConstraint.radius).toBe(25);
  });
});
