import { HorizontalConstraint } from './HorizontalConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

describe('HorizontalConstraint', () => {
  it('should create a HorizontalConstraint with the correct properties', () => {
    const horizontalConstraint: HorizontalConstraint = {
      id: 'horizontal1',
      type: SketchConstraintType.HORIZONTAL,
      lineId: 'line1',
    };

    expect(horizontalConstraint.id).toBe('horizontal1');
    expect(horizontalConstraint.type).toBe(SketchConstraintType.HORIZONTAL);
    expect(horizontalConstraint.lineId).toBe('line1');
  });
});
