import { VerticalConstraint } from './VerticalConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

describe('VerticalConstraint', () => {
  it('should create a VerticalConstraint with the correct properties', () => {
    const verticalConstraint: VerticalConstraint = {
      id: 'vertical1',
      type: SketchConstraintType.VERTICAL,
      lineId: 'line1',
    };

    expect(verticalConstraint.id).toBe('vertical1');
    expect(verticalConstraint.type).toBe(SketchConstraintType.VERTICAL);
    expect(verticalConstraint.lineId).toBe('line1');
  });
});
