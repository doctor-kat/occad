import { describe, it, expect, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ReferencePlanes } from './ReferencePlanes';
import { isPlaneVisible, buildReferenceVisibilityMap, createPlaneCrosshair } from './referencePlaneGeometry';

// drei's <Text> (troika) loads a font asynchronously and is irrelevant to the
// plane geometry under test — stub it so the scene graph stays deterministic.
vi.mock('@react-three/drei', () => ({ Text: () => null }));

describe('createPlaneCrosshair', () => {
  it('connects opposite-edge midpoints through the origin', () => {
    const geometry = createPlaneCrosshair(100);
    const pos = Array.from(geometry.getAttribute('position').array);
    expect(pos).toEqual([
      // Horizontal: left midpoint -> right midpoint
      -50, 0, 0, 50, 0, 0,
      // Vertical: bottom midpoint -> top midpoint
      0, -50, 0, 0, 50, 0,
    ]);
  });

  it('both segments pass through the origin', () => {
    const geometry = createPlaneCrosshair(100);
    const pos = geometry.getAttribute('position').array;
    // Each segment is symmetric about (0,0,0), so its midpoint is the origin.
    const mid = (a: number, b: number) => (a + b) / 2;
    expect([mid(pos[0], pos[3]), mid(pos[1], pos[4]), mid(pos[2], pos[5])]).toEqual([0, 0, 0]);
    expect([mid(pos[6], pos[9]), mid(pos[7], pos[10]), mid(pos[8], pos[11])]).toEqual([0, 0, 0]);
  });

  it('precomputes lineDistance per segment so dashes render', () => {
    const geometry = createPlaneCrosshair(100);
    expect(Array.from(geometry.getAttribute('lineDistance').array)).toEqual([0, 100, 0, 100]);
  });

  it('scales with the plane size', () => {
    const geometry = createPlaneCrosshair(40);
    const pos = geometry.getAttribute('position').array;
    expect(pos[0]).toBe(-20);
    expect(pos[3]).toBe(20);
  });
});

describe('buildReferenceVisibilityMap', () => {
  it('maps each reference id to its isVisible flag', () => {
    const map = buildReferenceVisibilityMap([
      { id: 'front-plane', isVisible: true },
      { id: 'top-plane', isVisible: false },
      { id: 'right-plane', isVisible: true },
      { id: 'origin', isVisible: false },
    ]);
    expect(map).toEqual({
      'front-plane': true,
      'top-plane': false,
      'right-plane': true,
      origin: false,
    });
  });

  it('treats a missing/undefined isVisible as not visible', () => {
    const map = buildReferenceVisibilityMap([{ id: 'front-plane' } as any]);
    expect(map['front-plane']).toBe(false);
  });

  it('returns an empty map for undefined input', () => {
    expect(buildReferenceVisibilityMap(undefined)).toEqual({});
  });
});

describe('isPlaneVisible', () => {
  const base = { selectedPlaneId: null, hoveredPlaneId: null, visibilityMap: {} };

  it('shows a plane whose visibility is toggled on', () => {
    expect(
      isPlaneVisible('front-plane', { ...base, visibilityMap: { 'front-plane': true } })
    ).toBe(true);
  });

  it('hides a plane whose visibility is toggled off', () => {
    expect(
      isPlaneVisible('front-plane', { ...base, visibilityMap: { 'front-plane': false } })
    ).toBe(false);
  });

  it('hides a plane absent from the visibility map and not selected/hovered', () => {
    expect(isPlaneVisible('top-plane', base)).toBe(false);
  });

  it('shows a selected plane even when not toggled visible', () => {
    expect(isPlaneVisible('right-plane', { ...base, selectedPlaneId: 'right-plane' })).toBe(true);
  });

  it('shows a hovered plane even when not toggled visible', () => {
    expect(isPlaneVisible('right-plane', { ...base, hoveredPlaneId: 'right-plane' })).toBe(true);
  });

  it('does not show other planes when a different plane is selected', () => {
    expect(isPlaneVisible('front-plane', { ...base, selectedPlaneId: 'top-plane' })).toBe(false);
  });

  it('keeps each plane independent in the visibility map', () => {
    const visibilityMap = { 'front-plane': true, 'top-plane': false, 'right-plane': true };
    expect(isPlaneVisible('front-plane', { ...base, visibilityMap })).toBe(true);
    expect(isPlaneVisible('top-plane', { ...base, visibilityMap })).toBe(false);
    expect(isPlaneVisible('right-plane', { ...base, visibilityMap })).toBe(true);
  });

  it('shows every plane when showAllPlanes is set (awaiting a sketch-plane pick)', () => {
    const opts = { ...base, showAllPlanes: true };
    expect(isPlaneVisible('front-plane', opts)).toBe(true);
    expect(isPlaneVisible('top-plane', opts)).toBe(true);
    expect(isPlaneVisible('right-plane', opts)).toBe(true);
  });

  it('does not force planes visible when showAllPlanes is false', () => {
    expect(isPlaneVisible('top-plane', { ...base, showAllPlanes: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Component-level rendering, via the real THREE scene graph
// (@react-three/test-renderer, no WebGL). Previously only the pure helpers were
// tested; this asserts the component actually emits geometry for the planes
// `isPlaneVisible` reports as visible, with the right highlight colour. Each
// visible plane renders 2 lineSegments: the square outline + the dashed
// crosshair.
// ---------------------------------------------------------------------------
async function renderPlanes(props: Partial<Parameters<typeof ReferencePlanes>[0]>) {
  return ReactThreeTestRenderer.create(
    <ReferencePlanes
      selectedPlaneId={null}
      hoveredPlaneId={null}
      visibilityMap={{}}
      {...props}
    />
  );
}

/** The square outline is the lineSegments with a (solid) LineBasicMaterial. */
const outlineColor = (renderer: Awaited<ReturnType<typeof renderPlanes>>): string | null => {
  const outline = renderer.scene
    .findAllByType('LineSegments')
    .find((l) => l.instance.material.type === 'LineBasicMaterial');
  return outline ? outline.instance.material.color.getHexString() : null;
};

describe('ReferencePlanes (rendering)', () => {
  it('renders nothing when no plane is visible/selected/hovered', async () => {
    const renderer = await renderPlanes({});
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('renders only the planes toggled visible (2 lineSegments each)', async () => {
    const renderer = await renderPlanes({ visibilityMap: { 'front-plane': true } });
    // one plane → outline + crosshair
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(2);
  });

  it('renders all three planes when showAllPlanes is set', async () => {
    const renderer = await renderPlanes({ showAllPlanes: true });
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(6); // 3 planes × 2
  });

  it('renders a selected plane even when not toggled visible', async () => {
    const renderer = await renderPlanes({ selectedPlaneId: 'right-plane' });
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(2);
  });

  it('colours the outline blue when selected, grey by default', async () => {
    expect(outlineColor(await renderPlanes({ visibilityMap: { 'front-plane': true } }))).toBe('888888');
    expect(
      outlineColor(await renderPlanes({ visibilityMap: { 'front-plane': true }, selectedPlaneId: 'front-plane' }))
    ).toBe('3b82f6');
  });

  it('places one invisible clickable plane mesh per visible plane', async () => {
    const renderer = await renderPlanes({ showAllPlanes: true });
    // Text is stubbed out, so the only meshes are the 3 click targets.
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(3);
  });
});
