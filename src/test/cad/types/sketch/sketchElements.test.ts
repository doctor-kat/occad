import { SketchArc, SketchCircle, SketchPoint, SketchElementType } from '@/cad/types/sketch/sketchElements';

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
