import { SketchPoint } from './SketchPoint';
import { SketchElementType } from './SketchElementType';

describe('SketchPoint', () => {
  it('should create a SketchPoint with the correct properties', () => {
    const point: SketchPoint = {
      type: SketchElementType.POINT,
      id: 'point1',
      x: 10,
      y: 20,
    };

    expect(point.type).toBe(SketchElementType.POINT);
    expect(point.id).toBe('point1');
    expect(point.x).toBe(10);
    expect(point.y).toBe(20);
  });
});
