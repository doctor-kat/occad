import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { SketchWireframes } from '@/frontend/viewport/opencascade/scene/SketchWireframes';
import { computeEdgeSegments } from '@/frontend/viewport/opencascade/geometry/edgeSegments';
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

// ---------------------------------------------------------------------------
// Component-level rendering, inspected via the real THREE scene graph
// (@react-three/test-renderer, no WebGL). The previous test only rendered
// inside a jsdom <Canvas> and asserted "did not crash" — which never built a
// scene graph, so the visibility filter, native-line tech, hit-areas and
// selection colour were all effectively untested.
// ---------------------------------------------------------------------------

/** Two collinear-ish segments → 2 cylinder hit-areas. */
const TWO_SEG = new Float32Array([0, 0, 0, 10, 0, 0, 10, 0, 0, 10, 10, 0]);

function makeProject(sketches: Array<{ id: string; isVisible: boolean }>): CADProject {
  return {
    id: 'p1',
    name: 'Test',
    version: 1,
    referenceGeometry: [],
    sketches: sketches.map((s) => ({ id: s.id, name: s.id, isVisible: s.isVisible })),
    features: [],
    createdAt: 0,
    updatedAt: 0,
  } as unknown as CADProject;
}

async function renderWireframes(opts: {
  sketches: Array<{ id: string; isVisible: boolean }>;
  edges: Record<string, Float32Array>;
  selectedSketchId?: string | null;
}) {
  const sketchEdges = Object.fromEntries(
    Object.entries(opts.edges).map(([id, edgeVertices]) => [id, { edgeVertices }])
  ) as unknown as Record<string, SketchEdgeData>;

  return ReactThreeTestRenderer.create(
    <SketchWireframes
      project={makeProject(opts.sketches)}
      sketchEdges={sketchEdges}
      selectedSketchId={opts.selectedSketchId ?? null}
      onSketchClick={() => {}}
    />
  );
}

const hexOf = (instance: { material: { color: THREE.Color } }) =>
  instance.material.color.getHexString();

describe('SketchWireframes', () => {
  it('renders only visible sketches that have edge data', async () => {
    const renderer = await renderWireframes({
      sketches: [
        { id: 's1', isVisible: true }, // visible + has edges → rendered
        { id: 's2', isVisible: false }, // hidden → skipped
        { id: 's3', isVisible: true }, // visible but no edge data → skipped
      ],
      edges: { s1: TWO_SEG },
    });

    // Exactly one sketch wireframe → one LineSegments object.
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
  });

  it('draws edges as a native LineSegments with LineBasicMaterial (not a fat Line2)', async () => {
    const renderer = await renderWireframes({
      sketches: [{ id: 's1', isVisible: true }],
      edges: { s1: TWO_SEG },
    });

    const segs = renderer.scene.findAllByType('LineSegments');
    expect(segs).toHaveLength(1);
    expect(segs[0].instance.material.type).toBe('LineBasicMaterial');
    expect(renderer.scene.findAllByType('Line2')).toHaveLength(0);
  });

  it('places one cylinder hit-area mesh per edge segment', async () => {
    const renderer = await renderWireframes({
      sketches: [{ id: 's1', isVisible: true }],
      edges: { s1: TWO_SEG }, // 2 segments
    });
    // The only meshes in this subtree are the invisible hit-areas.
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it('colours the selected sketch blue and an unselected one purple', async () => {
    const selected = await renderWireframes({
      sketches: [{ id: 's1', isVisible: true }],
      edges: { s1: TWO_SEG },
      selectedSketchId: 's1',
    });
    expect(hexOf(selected.scene.findByType('LineSegments').instance)).toBe('3b82f6'); // blue

    const unselected = await renderWireframes({
      sketches: [{ id: 's1', isVisible: true }],
      edges: { s1: TWO_SEG },
      selectedSketchId: null,
    });
    expect(hexOf(unselected.scene.findByType('LineSegments').instance)).toBe('a64dff'); // purple
  });
});
