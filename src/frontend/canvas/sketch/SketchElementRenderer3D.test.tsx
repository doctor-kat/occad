import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import { SketchElementRenderer3D } from './SketchElementRenderer3D';

/**
 * Regression guard for the "invisible sketch entities / preview" bug.
 *
 * Root cause: sketch geometry was drawn with drei's `<Line>` (a `Line2` fat line),
 * whose shader renders nothing on some GPU/ANGLE driver backends — so previews and
 * committed line/circle/rectangle entities were invisible for affected users, while
 * the native grid (LineBasicMaterial) drew fine. The fix renders sketch geometry
 * with native `THREE.Line` + `LineBasicMaterial`, which works on every backend.
 *
 * Why this wasn't caught before: the only sketch-overlay e2e checked for console
 * namespace errors, and the jsdom `<Canvas>` smoke test never builds a scene graph
 * (no WebGL), so an invisible-but-present line passed every check. This test
 * inspects the actual THREE scene graph via @react-three/test-renderer (no GPU),
 * so it fails the moment the renderer regresses back to a fat `Line2`.
 */

const lineEl: SketchElement = {
  type: SketchElementType.LINE,
  id: 'l1',
  start: { x: 0, y: 0 },
  end: { x: 10, y: 5 },
} as SketchElement;

const constructionLineEl: SketchElement = {
  type: SketchElementType.LINE,
  id: 'l2',
  start: { x: 0, y: 0 },
  end: { x: 10, y: 0 },
  construction: true,
} as SketchElement;

const rectEl: SketchElement = {
  type: SketchElementType.RECTANGLE,
  id: 'r1',
  corner1: { x: 0, y: 0 },
  corner2: { x: 10, y: 8 },
} as SketchElement;

const circleEl: SketchElement = {
  type: SketchElementType.CIRCLE,
  id: 'c1',
  center: { x: 0, y: 0 },
  radius: 5,
} as SketchElement;

async function renderElement(element: SketchElement, extra: Record<string, unknown> = {}) {
  return ReactThreeTestRenderer.create(
    <SketchElementRenderer3D element={element} color="#7c93c3" lineWidth={2} {...extra} />
  );
}

describe('SketchElementRenderer3D', () => {
  it('renders a line as a native THREE.Line with LineBasicMaterial (not a fat Line2)', async () => {
    const renderer = await renderElement(lineEl);

    const nativeLines = renderer.scene.findAllByType('Line');
    expect(nativeLines.length).toBe(1);
    expect(nativeLines[0].instance.material.type).toBe('LineBasicMaterial');

    // The fat-line implementation must NOT be used.
    expect(renderer.scene.findAllByType('Line2')).toHaveLength(0);
  });

  it('renders a rectangle as a single closed native line (5 verts incl. closing point)', async () => {
    const renderer = await renderElement(rectEl);
    const nativeLines = renderer.scene.findAllByType('Line');
    expect(nativeLines.length).toBe(1);

    const geo = nativeLines[0].instance.geometry;
    expect(geo.getAttribute('position').count).toBe(5); // closed loop
    expect(renderer.scene.findAllByType('Line2')).toHaveLength(0);
  });

  it('renders a circle as a native polyline (no fat Line2)', async () => {
    const renderer = await renderElement(circleEl);
    const nativeLines = renderer.scene.findAllByType('Line');
    expect(nativeLines.length).toBe(1);
    expect(nativeLines[0].instance.material.type).toBe('LineBasicMaterial');
    expect(renderer.scene.findAllByType('Line2')).toHaveLength(0);
  });

  it('renders a construction line dashed (LineDashedMaterial)', async () => {
    const renderer = await renderElement(constructionLineEl);
    const nativeLines = renderer.scene.findAllByType('Line');
    expect(nativeLines.length).toBe(1);
    expect(nativeLines[0].instance.material.type).toBe('LineDashedMaterial');
  });

  it('renders the draw preview (same component) as a native line so it is visible', async () => {
    // The live preview reuses this component with a yellow color + id 'preview'.
    const previewRect: SketchElement = { ...rectEl, id: 'preview' };
    const renderer = await ReactThreeTestRenderer.create(
      <SketchElementRenderer3D element={previewRect} color="#fbbf24" opacity={0.7} lineWidth={2} />
    );
    const nativeLines = renderer.scene.findAllByType('Line');
    expect(nativeLines.length).toBe(1);
    expect(nativeLines[0].instance.material.type).toBe('LineBasicMaterial');
    expect(renderer.scene.findAllByType('Line2')).toHaveLength(0);
  });
});
