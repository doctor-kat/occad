import { SketchCircle } from './SketchCircle';
import { SketchElementType } from './SketchElementType';

describe('SketchCircle', () => {
  it('should create a SketchCircle with the correct properties', () => {
    const circle: SketchCircle = {
      type: SketchElementType.CIRCLE,
      id: 'circle1',
      centerId: 'centerPoint1',
      radius: 50,
    };

    expect(circle.type).toBe(SketchElementType.CIRCLE);
    expect(circle.id).toBe('circle1');
    expect(circle.centerId).toBe('centerPoint1');
    expect(circle.radius).toBe(50);
  });
});
