import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { SketchRenderer } from './SketchRenderer';
import { SketchElementType } from '@/cad/types/sketch/SketchElementType';

describe('SketchRenderer', () => {
  it('renders without crashing with a basic sketch', () => {
    const mockSketch = {
      id: 's1',
      name: 'Test Sketch',
      plane: { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, type: 'XY' },
      elements: [
        { id: 'l1', type: SketchElementType.LINE, start: { x: 0, y: 0, id: 'p1' }, end: { x: 10, y: 10, id: 'p2' } },
        { id: 'p1', type: SketchElementType.POINT, x: 0, y: 0 },
        { id: 'p2', type: SketchElementType.POINT, x: 10, y: 10 },
      ],
      points: [
        { id: 'p1', type: SketchElementType.POINT, x: 0, y: 0 },
        { id: 'p2', type: SketchElementType.POINT, x: 10, y: 10 },
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
