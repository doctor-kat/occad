import { describe, it, expect, afterEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { ExtrudeArrows } from '@/frontend/viewport/opencascade/scene/ExtrudeArrows';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import type { CADProject } from '@/cad/types';

/**
 * ExtrudeArrows draws the +normal / -normal direction arrows for the extrude
 * preview. It returns null in several gating cases (no preview, null sketchId,
 * missing sketch/workplane); those branches were previously untested. We render
 * the real scene graph via @react-three/test-renderer and assert the actual
 * ArrowHelper output.
 */

const workplane = {
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
};

const projectWithSketch: CADProject = {
  id: 'p1',
  name: 'Test',
  version: 1,
  referenceGeometry: [],
  sketches: [{ id: 's1', name: 'Sketch 1', workplane }],
  features: [],
  createdAt: 0,
  updatedAt: 0,
} as unknown as CADProject;

const setPreview = useViewportStore.getState().setExtrudePreview;

afterEach(() => setPreview(null));

// The arrows are added as raw `<primitive object={ArrowHelper}>`; those bypass
// R3F's reconciler instance tree, so test-renderer's findByType traversal chokes
// on them. Traverse the real THREE scene instead.
function arrowsIn(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>
): THREE.ArrowHelper[] {
  const found: THREE.ArrowHelper[] = [];
  (renderer.scene.instance as THREE.Object3D).traverse((o) => {
    if (o.type === 'ArrowHelper') found.push(o as THREE.ArrowHelper);
  });
  return found;
}

describe('ExtrudeArrows', () => {
  it('renders nothing when there is no extrude preview', async () => {
    setPreview(null);
    const renderer = await ReactThreeTestRenderer.create(<ExtrudeArrows project={projectWithSketch} />);
    expect(arrowsIn(renderer)).toHaveLength(0);
  });

  it('renders nothing when the preview has a null sketchId', async () => {
    setPreview({ sketchId: null, distance: 10, direction: 'normal' });
    const renderer = await ReactThreeTestRenderer.create(<ExtrudeArrows project={projectWithSketch} />);
    expect(arrowsIn(renderer)).toHaveLength(0);
  });

  it('renders nothing when the preview references a missing sketch', async () => {
    setPreview({ sketchId: 'does-not-exist', distance: 10, direction: 'normal' });
    const renderer = await ReactThreeTestRenderer.create(<ExtrudeArrows project={projectWithSketch} />);
    expect(arrowsIn(renderer)).toHaveLength(0);
  });

  it('renders both direction arrows (blue +normal, orange -normal) for a valid preview', async () => {
    setPreview({ sketchId: 's1', distance: 10, direction: 'normal' });
    const renderer = await ReactThreeTestRenderer.create(<ExtrudeArrows project={projectWithSketch} />);

    const arrows = arrowsIn(renderer);
    expect(arrows).toHaveLength(2);

    const colors = arrows.map((a) => (a.line.material as THREE.LineBasicMaterial).color.getHex());
    expect(colors).toContain(0x3b82f6); // forward (normal)
    expect(colors).toContain(0xf97316); // reverse
  });
});
