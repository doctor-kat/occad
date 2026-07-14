import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { Sketch } from '@/cad/types';
import { SketchOperation, SketchElementType } from '@/cad/types';
import { SketchOverlay } from './SketchOverlay';

/**
 * The Dimension tool (SketchOperation.DIMENSION) lets the user click two
 * point-primitive handles in sequence to create a driving Distance constraint,
 * instead of the removed toolbar Distance button. Verified against the real
 * scene graph (@react-three/test-renderer) since the pick logic lives in the
 * point-handle mesh onClick handlers, not the plane click handler.
 */

const workplane = {
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
};

function makeSketch(): Sketch {
  return {
    id: 's1',
    name: 'Test',
    workplane,
    primitives: [
      { id: 'p1', type: 'point', fixed: false, data: { x: 0, y: 0 } },
      { id: 'p2', type: 'point', fixed: false, data: { x: 10, y: 0 } },
    ],
    constraints: [],
    visualMetadata: {},
    elements: [],
    isClosed: false,
    isVisible: true,
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Sketch;
}

/** Find the point-handle mesh positioned at (x, y) — handles render at z=0.2,
 *  distinct from the plane (z=0.01) and origin marker (z=0.03) meshes. */
function handleAt(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>, x: number, y: number) {
  return renderer.scene
    .findAllByType('Mesh')
    .find((m) => Math.abs(m.instance.position.x - x) < 1e-6
      && Math.abs(m.instance.position.y - y) < 1e-6
      && Math.abs(m.instance.position.z - 0.2) < 1e-6);
}

/** The sketch plane mesh (the only Mesh using a PlaneGeometry). */
function planeMeshOf(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene
    .findAllByType('Mesh')
    .find((m) => m.instance.geometry.type === 'PlaneGeometry')!;
}

describe('SketchOverlay — Dimension tool (2-point pick)', () => {
  it('arms the first point, then applies a Distance constraint on the second click', async () => {
    const onCreateConstraint = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <SketchOverlay
        sketch={makeSketch()}
        activeOperation={SketchOperation.DIMENSION}
        onElementsChange={vi.fn()}
        onCreateConstraint={onCreateConstraint}
      />
    );

    const p1 = handleAt(renderer, 0, 0)!;
    await renderer.fireEvent(p1, 'click');
    expect(onCreateConstraint).not.toHaveBeenCalled();
    // Armed: bigger radius + orange highlight (matches the existing "selected" style).
    expect(handleAt(renderer, 0, 0)!.instance.material.color.getHexString()).toBe('f97316');

    const p2 = handleAt(renderer, 10, 0)!;
    await renderer.fireEvent(p2, 'click');
    expect(onCreateConstraint).toHaveBeenCalledTimes(1);
    expect(onCreateConstraint).toHaveBeenCalledWith({ kind: 'distance', p1Id: 'p1', p2Id: 'p2', distance: 10 });

    // Armed state cleared after committing — back to the default colour.
    expect(handleAt(renderer, 0, 0)!.instance.material.color.getHexString()).toBe('94a3b8');
  });

  it('clicking the same point twice is a no-op (stays armed)', async () => {
    const onCreateConstraint = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <SketchOverlay
        sketch={makeSketch()}
        activeOperation={SketchOperation.DIMENSION}
        onElementsChange={vi.fn()}
        onCreateConstraint={onCreateConstraint}
      />
    );

    const p1 = handleAt(renderer, 0, 0)!;
    await renderer.fireEvent(p1, 'click');
    await renderer.fireEvent(handleAt(renderer, 0, 0)!, 'click');
    expect(onCreateConstraint).not.toHaveBeenCalled();
    expect(handleAt(renderer, 0, 0)!.instance.material.color.getHexString()).toBe('f97316');
  });

  it('Escape clears the armed point without creating a constraint', async () => {
    const onCreateConstraint = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <SketchOverlay
        sketch={makeSketch()}
        activeOperation={SketchOperation.DIMENSION}
        onElementsChange={vi.fn()}
        onCreateConstraint={onCreateConstraint}
      />
    );

    await renderer.fireEvent(handleAt(renderer, 0, 0)!, 'click');
    expect(handleAt(renderer, 0, 0)!.instance.material.color.getHexString()).toBe('f97316');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((r) => setTimeout(r, 0));

    expect(handleAt(renderer, 0, 0)!.instance.material.color.getHexString()).toBe('94a3b8');
    expect(onCreateConstraint).not.toHaveBeenCalled();
  });

  it('point + line pick creates a point-line-distance constraint', async () => {
    const onCreateConstraint = vi.fn();
    const sketch: Sketch = {
      id: 's1',
      name: 'Test',
      workplane,
      primitives: [
        { id: 'p1', type: 'point', fixed: false, data: { x: 5, y: 5 } },
        { id: 'l1', type: 'point', fixed: false, data: { x: 0, y: 20 } },
        { id: 'l2', type: 'point', fixed: false, data: { x: 10, y: 20 } },
        { id: 'L', type: 'line', fixed: false, data: { p1_id: 'l1', p2_id: 'l2' } },
      ],
      constraints: [],
      visualMetadata: {},
      elements: [
        { type: SketchElementType.LINE, id: 'L', start: { x: 0, y: 20 }, end: { x: 10, y: 20 } },
      ],
      isClosed: false,
      isVisible: true,
      createdAt: 0,
      updatedAt: 0,
    } as unknown as Sketch;

    const renderer = await ReactThreeTestRenderer.create(
      <SketchOverlay
        sketch={sketch}
        activeOperation={SketchOperation.DIMENSION}
        onElementsChange={vi.fn()}
        onCreateConstraint={onCreateConstraint}
      />
    );

    // Arm the point first.
    await renderer.fireEvent(handleAt(renderer, 5, 5)!, 'click');
    // Click on the line via the plane (no dedicated line-handle mesh exists).
    await renderer.fireEvent(planeMeshOf(renderer), 'click', { point: new THREE.Vector3(5, 20, 0) });

    expect(onCreateConstraint).toHaveBeenCalledTimes(1);
    expect(onCreateConstraint).toHaveBeenCalledWith({
      kind: 'point-line-distance', pointId: 'p1', lineId: 'L', distance: 15,
    });
  });

  it('does not render grid/snap indicators while in Dimension mode', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SketchOverlay
        sketch={makeSketch()}
        activeOperation={SketchOperation.DIMENSION}
        onElementsChange={vi.fn()}
        onCreateConstraint={vi.fn()}
      />
    );

    await renderer.fireEvent(planeMeshOf(renderer), 'pointerMove', { point: new THREE.Vector3(3, 3, 0) });

    // The hover-point indicator and grid-snap ring are only ever rendered as
    // RingGeometry (snap) — assert none exists (no grid/origin snapping while
    // dimensioning; only entity highlighting, which uses CircleGeometry on
    // existing handles, covered by the other tests).
    const rings = renderer.scene.findAllByType('Mesh').filter((m) => m.instance.geometry.type === 'RingGeometry');
    expect(rings).toHaveLength(0);
  });
});
