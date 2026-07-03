import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { Sketch } from '@/cad/types';
import { SketchRenderer } from './SketchRenderer';
import { useViewportStore } from '@/frontend/shared/viewportStore';

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
 *
 * drei's `<Text>` (troika-three-text) never resolves in this test environment
 * (no font-loading network access) and — critically — its failure isn't
 * contained: with no error boundary, an unresolved/throwing `<Text>` blanks the
 * *entire* scene graph, including sibling `<Line>`s in the same group. Any test
 * that renders a dimension annotation (which pairs polylines with a `<Text>`
 * label) must mock `Text` out to a plain mesh so the surrounding geometry is
 * still inspectable.
 */
vi.mock('@react-three/drei', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-three/drei')>();
  return { ...actual, Text: (props: any) => <mesh userData={{ text: props.children }} /> };
});

const workplane = {
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
};

type Prim = { id: string; type: string; data: Record<string, unknown>; isExternal?: boolean };

function makeSketch(primitives: Prim[], dof = 1, constraints: any[] = [], visualMetadata: Record<string, any> = {}): Sketch {
  return {
    id: 's1',
    name: 'Test',
    workplane,
    primitives,
    constraints,
    visualMetadata,
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
  beforeEach(() => {
    useViewportStore.getState().setSelectedConstraintId(null);
  });

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

  it('renders a p2p_distance dimension with extension lines, dimension line, and arrows', async () => {
    const constraint = { id: 'c1', type: 'p2p_distance', p1_id: 'p1', p2_id: 'p2', distance: 10 };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer
        sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0)], 1, [constraint])}
      />
    );
    // 2 extension lines + 1 dimension line + 2 arrows = 5 Line instances for the dimension.
    expect(renderer.scene.findAllByType('Line')).toHaveLength(5);
    expect(renderer.scene.findAllByType('Mesh').find((m) => m.instance.userData.text === '10.00')).toBeDefined();
  });

  it('clicking an arrowhead reports which one via onToggleArrowFlip, and visualMetadata.arrowFlip flips its direction', async () => {
    const constraint = { id: 'c1', type: 'p2p_distance', p1_id: 'p1', p2_id: 'p2', distance: 10 };
    const onToggleArrowFlip = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer
        sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0)], 1, [constraint])}
        onToggleArrowFlip={onToggleArrowFlip}
      />
    );
    // Arrow hit-targets are the two CircleGeometry meshes (the label hit-area is a
    // PlaneGeometry); order matches arrow1 then arrow2.
    const arrowHits = renderer.scene.findAllByType('Mesh').filter((m) => m.instance.geometry.type === 'CircleGeometry');
    expect(arrowHits).toHaveLength(2);

    await renderer.fireEvent(arrowHits[0], 'click');
    expect(onToggleArrowFlip).toHaveBeenCalledWith('c1', 'arrow1');

    await renderer.fireEvent(arrowHits[1], 'click');
    expect(onToggleArrowFlip).toHaveBeenCalledWith('c1', 'arrow2');

    // With arrow1 flipped via visualMetadata, its chevron should mirror to point
    // outward (wings trail toward larger x instead of smaller x).
    const flipped = await ReactThreeTestRenderer.create(
      <SketchRenderer
        sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0)], 1, [constraint], { c1: { isDriving: false, arrowFlip: { arrow1: true } } })}
      />
    );
    const lines = flipped.scene.findAllByType('Line');
    // ext1, ext2, dimLine, arrow1, arrow2 — arrow1 is index 3.
    const arrow1Points = lines[3].instance.geometry.attributes.position.array;
    expect(arrow1Points[0]).toBeGreaterThan(arrow1Points[3]); // wing[0].x > tip.x now (flipped)
  });

  it('renders a p2l_distance dimension (previously silently rendered nothing)', async () => {
    const constraint = { id: 'c1', type: 'p2l_distance', p_id: 'p', l_id: 'L', distance: 8 };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer
        sketch={makeSketch(
          [point('l1', 0, 0), point('l2', 10, 0), line('L', 'l1', 'l2'), point('p', 5, 8)],
          1,
          [constraint],
        )}
      />
    );
    // 1 for the referenced line primitive itself + 5 for the dimension annotation.
    expect(renderer.scene.findAllByType('Line')).toHaveLength(6);
    expect(renderer.scene.findAllByType('Mesh').find((m) => m.instance.userData.text === '8.00')).toBeDefined();
  });

  it('renders a difference (horizontal/vertical) dimension', async () => {
    const constraint = { id: 'c1', type: 'difference', param1: { o_id: 'p1', prop: 'x' }, param2: { o_id: 'p2', prop: 'x' }, difference: 10 };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 5)], 1, [constraint])} />
    );
    expect(renderer.scene.findAllByType('Line')).toHaveLength(5);
    expect(renderer.scene.findAllByType('Mesh').find((m) => m.instance.userData.text === '10.00')).toBeDefined();
  });

  it('defaults a p2p_distance label to the outward side of the sketch, regardless of point click order', async () => {
    // A square; dimensioning its left edge with the points picked "backwards"
    // (top corner first) used to flip the perpendicular and push the label
    // rightward, into the square, instead of outward to the left.
    const square = [
      point('bl', 0, 0), point('br', 10, 0), point('tr', 10, 10), point('tl', 0, 10),
    ];
    const constraint = { id: 'c1', type: 'p2p_distance', p1_id: 'tl', p2_id: 'bl', distance: 10 };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch(square, 1, [constraint])} />
    );
    const labelHitMesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => m.instance.geometry.type === 'PlaneGeometry')!;
    expect(labelHitMesh.instance.position.x).toBeLessThan(0); // left of the square, not into it
  });

  it('a plain click (no drag) selects the dimension and turns it orange; clicking again deselects', async () => {
    const constraint = { id: 'c1', type: 'p2p_distance', p1_id: 'p1', p2_id: 'p2', distance: 10 };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0)], 1, [constraint])} />
    );
    const dimLine = () => renderer.scene.findAllByType('Line')[2]; // ext1, ext2, then the dimension line itself
    expect(hexOf(dimLine().instance)).not.toBe('f97316');

    const dragHitMesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => m.instance.geometry.type === 'PlaneGeometry')!;

    await renderer.fireEvent(dragHitMesh, 'pointerDown', { clientX: 100, clientY: 100 });
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 100, clientY: 100 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(useViewportStore.getState().selectedConstraintId).toBe('c1');
    expect(hexOf(dimLine().instance)).toBe('f97316');

    await renderer.fireEvent(dragHitMesh, 'pointerDown', { clientX: 100, clientY: 100 });
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 100, clientY: 100 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(useViewportStore.getState().selectedConstraintId).toBe(null);
  });

  it('an actual drag (pointer moves past the threshold) does not select', async () => {
    // Full drag-commit (onUpdateLabelOffset) needs a real camera/canvas raycast
    // against the sketch plane, which this test environment's mocked camera/gl
    // don't support reliably (no real DOM canvas sizing) — so this only asserts
    // the click-vs-drag branch: once the pointer moves past DRAG_THRESHOLD,
    // pointerup must NOT fall into the select/deselect branch.
    const constraint = { id: 'c1', type: 'p2p_distance', p1_id: 'p1', p2_id: 'p2', distance: 10 };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0)], 1, [constraint])} />
    );
    const dragHitMesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => m.instance.geometry.type === 'PlaneGeometry')!;

    await renderer.fireEvent(dragHitMesh, 'pointerDown', { clientX: 100, clientY: 100 });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140, clientY: 140 }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 140, clientY: 140 }));
    await new Promise((r) => setTimeout(r, 0));

    expect(useViewportStore.getState().selectedConstraintId).toBe(null);
  });

  it('sets viewportStore.draggingDimensionLabel while a label drag is in progress, so SketchOverlay box-select can bail out', async () => {
    const constraint = { id: 'c1', type: 'p2p_distance', p1_id: 'p1', p2_id: 'p2', distance: 10 };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0)], 1, [constraint])} />
    );
    const dragHitMesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => m.instance.geometry.type === 'PlaneGeometry')!;

    expect(useViewportStore.getState().draggingDimensionLabel).toBe(false);
    await renderer.fireEvent(dragHitMesh, 'pointerDown', { clientX: 100, clientY: 100 });
    expect(useViewportStore.getState().draggingDimensionLabel).toBe(true);

    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 100, clientY: 100 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(useViewportStore.getState().draggingDimensionLabel).toBe(false);
  });

  it('highlights the dimension with the selection color while it is being dragged, even before pointerup commits a selection', async () => {
    const constraint = { id: 'c1', type: 'p2p_distance', p1_id: 'p1', p2_id: 'p2', distance: 10 };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchRenderer sketch={makeSketch([point('p1', 0, 0), point('p2', 10, 0)], 1, [constraint])} />
    );
    const dimLine = () => renderer.scene.findAllByType('Line')[2];
    const dragHitMesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => m.instance.geometry.type === 'PlaneGeometry')!;

    await renderer.fireEvent(dragHitMesh, 'pointerDown', { clientX: 100, clientY: 100 });
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140, clientY: 140 }));
    await new Promise((r) => setTimeout(r, 0));

    // Not yet released/selected, but already dragging — should already read as orange.
    expect(useViewportStore.getState().selectedConstraintId).toBe(null);
    expect(hexOf(dimLine().instance)).toBe('f97316');
  });
});
