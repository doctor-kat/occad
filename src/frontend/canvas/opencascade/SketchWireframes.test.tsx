import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { SketchWireframes } from './SketchWireframes';
import { computeEdgeSegments } from './edgeSegments';
import type { CADProject, SketchEdgeData } from '@/cad/types';

describe('computeEdgeSegments', () => {
  it('produces one oriented cylinder transform per segment', () => {
    // Two segments: (0,0,0)->(10,0,0) and (10,0,0)->(10,10,0)
    const edges = new Float32Array([
      0, 0, 0, 10, 0, 0,
      10, 0, 0, 10, 10, 0,
    ]);

    const segments = computeEdgeSegments(edges);
    expect(segments).toHaveLength(2);

    // First segment: length 10, midpoint (5,0,0)
    expect(segments[0].length).toBeCloseTo(10);
    expect(segments[0].position.x).toBeCloseTo(5);
    expect(segments[0].position.y).toBeCloseTo(0);

    // Second segment: length 10, midpoint (10,5,0)
    expect(segments[1].length).toBeCloseTo(10);
    expect(segments[1].position.x).toBeCloseTo(10);
    expect(segments[1].position.y).toBeCloseTo(5);

    segments.forEach((s) => expect(s.quaternion).toBeInstanceOf(THREE.Quaternion));
  });

  it('skips degenerate (zero-length) segments', () => {
    const edges = new Float32Array([5, 5, 0, 5, 5, 0]); // start === end
    expect(computeEdgeSegments(edges)).toHaveLength(0);
  });

  it('orients the cylinder so its axis is collinear with the segment', () => {
    // Segment along world +X. The cylinder is modelled along local Y; its axis must
    // be collinear with the segment (sign is irrelevant — a cylinder is symmetric),
    // so |Y·segmentDir| ≈ 1 and the perpendicular components vanish.
    const [seg] = computeEdgeSegments(new Float32Array([0, 0, 0, 10, 0, 0]));
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(seg.quaternion);
    expect(Math.abs(axis.x)).toBeCloseTo(1);
    expect(axis.y).toBeCloseTo(0);
    expect(axis.z).toBeCloseTo(0);
  });

  it('ignores a trailing partial segment (non-multiple-of-6 length)', () => {
    // 6 floats = 1 full segment; the extra 3 floats are an incomplete segment.
    const edges = new Float32Array([0, 0, 0, 10, 0, 0, 1, 2, 3]);
    expect(computeEdgeSegments(edges)).toHaveLength(1);
  });
});

describe('SketchWireframes', () => {
  it('renders visible sketches with edge data without crashing', () => {
    const project = {
      id: 'p1',
      name: 'Test',
      version: 1,
      referenceGeometry: [],
      sketches: [
        { id: 's1', name: 'Sketch 1', isVisible: true },
        { id: 's2', name: 'Hidden', isVisible: false },
      ],
      features: [],
      createdAt: 0,
      updatedAt: 0,
    } as unknown as CADProject;

    const sketchEdges = {
      s1: { edgeVertices: new Float32Array([0, 0, 0, 10, 0, 0, 10, 0, 0, 10, 10, 0]) },
    } as unknown as Record<string, SketchEdgeData>;

    render(
      <Canvas>
        <SketchWireframes
          project={project}
          sketchEdges={sketchEdges}
          selectedSketchId="s1"
          onSketchClick={() => {}}
        />
      </Canvas>
    );
  });
});
