import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { OriginPoint } from './OriginPoint';

/**
 * OriginPoint draws the origin marker (a sphere) plus the three coloured axis
 * bars. It gates on `visible` and restyles when the origin is selected/dimmed.
 * Verified against the real THREE scene graph (@react-three/test-renderer).
 */

const sphereOf = (renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) =>
  renderer.scene
    .findAllByType('Mesh')
    .find((m) => m.instance.geometry.type === 'SphereGeometry');

describe('OriginPoint', () => {
  it('renders nothing when not visible', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OriginPoint visible={false} selectedPlaneId={null} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('renders the origin sphere plus three axis markers when visible', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OriginPoint visible selectedPlaneId={null} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(4); // sphere + X/Y/Z
  });

  it('colours the origin white when selected, grey otherwise', async () => {
    const selected = await ReactThreeTestRenderer.create(
      <OriginPoint visible selectedPlaneId="origin" />
    );
    expect(sphereOf(selected)!.instance.material.color.getHexString()).toBe('ffffff');

    const unselected = await ReactThreeTestRenderer.create(
      <OriginPoint visible selectedPlaneId={null} />
    );
    expect(sphereOf(unselected)!.instance.material.color.getHexString()).toBe('888888');
  });

  it('dims the origin sphere opacity when dimmed', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OriginPoint visible selectedPlaneId={null} dimmed />
    );
    expect(sphereOf(renderer)!.instance.material.opacity).toBeCloseTo(0.2);
  });
});
