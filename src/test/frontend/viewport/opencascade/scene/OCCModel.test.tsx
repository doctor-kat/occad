import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { OCCModel } from '@/frontend/viewport/opencascade/scene/OCCModel';
import type { MeshData } from '@/cad/types';

/**
 * OCCModel renders the solid body (faces + edges + vertices) and the
 * face/edge/vertex selection highlights. It was untested at the scene-graph
 * level; these tests build a synthetic mesh (a 10×10 quad = 2 triangles on 2 CAD
 * faces, with 2 topological edges) and assert the real THREE output via
 * @react-three/test-renderer.
 */

// 4 corners of a square in the XY plane.
const faceVertices = new Float32Array([
  0, 0, 0,
  10, 0, 0,
  10, 10, 0,
  0, 10, 0,
]);
const faceNormals = new Float32Array([
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
]);
// Two triangles: [0,1,2] and [0,2,3].
const faceIndices = new Uint32Array([0, 1, 2, 0, 2, 3]);
// Triangle 0 → CAD face 0, triangle 1 → CAD face 1.
const faceMapping = new Uint32Array([0, 1]);
// Two edge segments → two topological edges.
const edgeVertices = new Float32Array([
  0, 0, 0, 10, 0, 0,
  10, 0, 0, 10, 10, 0,
]);
const edgeMapping = new Uint32Array([0, 1]);

const baseMesh: MeshData = {
  faceVertices,
  faceNormals,
  faceIndices,
  faceMapping,
  edgeVertices,
  edgeMapping,
} as MeshData;

const meshesByMaterial = (
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  materialType: string
) => renderer.scene.findAllByType('Mesh').filter((m) => m.instance.material.type === materialType);

describe('OCCModel', () => {
  it('renders the solid faces as a MeshPhysicalMaterial mesh with the supplied geometry', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OCCModel mesh={baseMesh} />);

    const solids = meshesByMaterial(renderer, 'MeshPhysicalMaterial');
    expect(solids).toHaveLength(1);
    const geo = solids[0].instance.geometry;
    expect(geo.getAttribute('position').count).toBe(4);
    expect(geo.index.count).toBe(6); // two triangles
  });

  it('renders one lineSegments per topological edge (native LineBasicMaterial)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OCCModel mesh={baseMesh} />);
    const edges = renderer.scene.findAllByType('LineSegments');
    expect(edges).toHaveLength(2);
    edges.forEach((e) => expect(e.instance.material.type).toBe('LineBasicMaterial'));
  });

  it('renders a points object for the clickable vertices', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OCCModel mesh={baseMesh} />);
    const points = renderer.scene.findAllByType('Points');
    expect(points).toHaveLength(1);
    expect(points[0].instance.material.type).toBe('PointsMaterial');
  });

  it('renders edge-hover cylinders only outside sketch mode', async () => {
    // Outside sketch mode: face mesh (1) + one hit-cylinder per segment (2) = 3 meshes.
    const normal = await ReactThreeTestRenderer.create(<OCCModel mesh={baseMesh} />);
    expect(normal.scene.findAllByType('Mesh')).toHaveLength(3);

    // In sketch mode: cylinders are dropped, leaving just the (dimmed) solid.
    const sketch = await ReactThreeTestRenderer.create(<OCCModel mesh={baseMesh} inSketchMode />);
    expect(sketch.scene.findAllByType('Mesh')).toHaveLength(1);
    const solid = meshesByMaterial(sketch, 'MeshPhysicalMaterial')[0];
    expect(solid.instance.material.transparent).toBe(true);
    expect(solid.instance.material.opacity).toBeCloseTo(0.3);
  });

  it('highlights the selected face blue (only its triangle)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OCCModel mesh={baseMesh} selectedFaceId={0} />);

    const highlight = meshesByMaterial(renderer, 'MeshBasicMaterial').find(
      (m) => m.instance.material.color.getHexString() === '3b82f6'
    );
    expect(highlight).toBeDefined();
    // Face 0 is a single triangle → 3 vertices.
    expect(highlight!.instance.geometry.getAttribute('position').count).toBe(3);
  });

  it('colours the selected edge blue and the rest dark', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OCCModel mesh={baseMesh} selectedEdgeIndex={0} />);
    const colors = renderer.scene
      .findAllByType('LineSegments')
      .map((e) => e.instance.material.color.getHexString());
    expect(colors).toContain('3b82f6'); // selected edge
    expect(colors).toContain('222233'); // unselected edge
  });
});
