import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { SketchRenderer } from './SketchRenderer';
import { SketchElementType } from '@/cad/types/sketch/SketchElementType';
import { SketchPoint } from '@/cad/types/sketch/SketchPoint';
import { SketchCircle } from '@/cad/types/sketch/SketchCircle';
import { SketchArc } from '@/cad/types/sketch/SketchArc';

describe('SketchRenderer', () => {
  it('renders without crashing with a basic sketch including circles and arcs', () => {
    const point1: SketchPoint = { id: 'p1', type: SketchElementType.POINT, x: 0, y: 0 };
    const point2: SketchPoint = { id: 'p2', type: SketchElementType.POINT, x: 10, y: 10 };
    const point3: SketchPoint = { id: 'p3', type: SketchElementType.POINT, x: 5, y: 0 }; // Arc start
    const point4: SketchPoint = { id: 'p4', type: SketchElementType.POINT, x: -5, y: 0 }; // Arc end
    const point5: SketchPoint = { id: 'p5', type: SketchElementType.POINT, x: 0, y: 0 }; // Arc center

    const circle1: SketchCircle = { id: 'c1', type: SketchElementType.CIRCLE, centerId: point1.id, radius: 5 };
    const arc1: SketchArc = { id: 'a1', type: SketchElementType.ARC, centerId: point5.id, radius: 5, startPointId: point3.id, endPointId: point4.id };

    const mockSketch = {
      id: 's1',
      name: 'Test Sketch',
      plane: { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, type: 'XY' },
      elements: [
        { id: 'l1', type: SketchElementType.LINE, start: point1, end: point2 },
        circle1,
        arc1
      ],
      points: [
        point1, point2, point3, point4, point5
      ],
      constraints: [],
      isClosed: false,
      isVisible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    render(
      <Canvas>
        <SketchRenderer sketch={mockSketch} />
      </Canvas>
    );
  });
});
