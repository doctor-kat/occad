import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { Sketch } from '@/cad/types';
import { SketchRenderer } from './SketchRenderer';

/**
 * SketchRenderer draws the *solved* sketch primitives (from planegcs) in the
 * viewport. It reads `sketch.primitives` / `workplane` / `dof` — NOT `elements`.
 *
 * The previous test rendered a `{ elements: [...] }` mock inside a jsdom
 * <Canvas>; because that Canvas never builds a scene graph without WebGL, the
 * component body never executed (it would have thrown on `primitives.map`), yet
 * the test "passed". These tests render the real scene graph via
 * @react-three/test-renderer and assert the actual output — including that
 * geometry uses native lines (LineBasicMaterial), not drei's fat `Line2`, the
 * same regression that made sketch geometry invisible on some GPUs.
 */

const workplane = {
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
};

type Prim = { id: string; type: string; data: Record<string, unknown>; isExternal?: boolean };

function makeSketch(primitives: Prim[], dof = 1): Sketch {
  return {
    id: 's1',
    name: 'Test',
    workplane,
    primitives,
    constraints: [],
    visualMetadata: {},
    dof,
    elements: [],
    isClosed: false,
    isVisible: true,
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Sketch;
}

const point = (id: string, x: number, y: number, isExternal = false): Prim => ({
  id, type: 'point', data: { x, y }, isExternal,
});
const line = (id: string, p1: string, p2: string, isExternal = false): Prim => ({
  id, type: 'line', data: { p1_id: p1, p2_id: p2 }, isExternal,
});
const circle = (id: string, c: string, radius: number, isExternal = false): Prim => ({
  id, type: 'circle', data: { c_id: c, radius }, isExternal,
});

const hexOf = (instance: { material: { color: THREE.Color } }) =>
  instance.material.color.getHexString();

describe('SketchRenderer', () => {
  it('renders line + circle primitives as native lines (not fat Line2)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer
        sketch={makeSketch([
          point('p1', 0, 0),
          point('p2', 10, 0),
          line('L', 'p1', 'p2'),
          point('cc', 5, 5),
          circle('C', 'cc', 3),
        ])}
      />
    );

    const lines = renderer.scene.findAllByType('Line');
    expect(lines).toHaveLength(2); // one line + one circle polyline
    lines.forEach((l) => expect(l.instance.material.type).toBe('LineBasicMaterial'));
    expect(renderer.scene.findAllByType('Line2')).toHaveLength(0);
  });

  it('renders each point primitive as a mesh (sphere)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0), line('L', 'p1', 'p2')])} />
    );
    // Two points → two sphere meshes (the line itself is a Line, not a Mesh).
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it('draws external geometry dashed (LineDashedMaterial)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer
        sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0), line('L', 'p1', 'p2', true)])}
      />
    );
    const l = renderer.scene.findByType('Line');
    expect(l.instance.material.type).toBe('LineDashedMaterial');
  });

  it('colours fully-constrained (dof 0) geometry green, under-constrained blue', async () => {
    const green = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0), line('L', 'p1', 'p2')], 0)} />
    );
    expect(hexOf(green.scene.findByType('Line').instance)).toBe('10b981'); // green

    const blue = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0), line('L', 'p1', 'p2')], 3)} />
    );
    expect(hexOf(blue.scene.findByType('Line').instance)).toBe('3b82f6'); // blue
  });
});
