import { SketchArc } from './SketchArc';
import { SketchElementType } from './SketchElementType';

describe('SketchArc', () => {
  it('should create a SketchArc with the correct properties', () => {
    const arc: SketchArc = {
      type: SketchElementType.ARC,
      id: 'arc1',
      centerId: 'centerPoint1',
      radius: 30,
      startPointId: 'startPoint1',
      endPointId: 'endPoint1',
    };

    expect(arc.type).toBe(SketchElementType.ARC);
    expect(arc.id).toBe('arc1');
    expect(arc.centerId).toBe('centerPoint1');
    expect(arc.radius).toBe(30);
    expect(arc.startPointId).toBe('startPoint1');
    expect(arc.endPointId).toBe('endPoint1');
  });
});
