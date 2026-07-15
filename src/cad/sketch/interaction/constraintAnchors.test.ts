import { describe, it, expect } from 'vitest';
import { resolveEntityPoint, constraintAnchor, constraintIconPlacements } from './constraintAnchors';
import { inferAutoConstraints } from '@/cad/sketch/solver';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';

const line: SketchElement = {
  type: SketchElementType.LINE,
  id: 'L',
  start: { x: 0, y: 0 },
  end: { x: 10, y: 0 },
};

const circle: SketchElement = {
  type: SketchElementType.CIRCLE,
  id: 'C',
  center: { x: 5, y: 5 },
  radius: 3,
};

const rect: SketchElement = {
  type: SketchElementType.RECTANGLE,
  id: 'R',
  corner1: { x: 0, y: 0 },
  corner2: { x: 10, y: 6 },
};

describe('resolveEntityPoint', () => {
  it('resolves a line by id to its midpoint', () => {
    expect(resolveEntityPoint('L', [line])).toEqual({ x: 5, y: 0 });
  });

  it('resolves line endpoints', () => {
    expect(resolveEntityPoint('L_p1', [line])).toEqual({ x: 0, y: 0 });
    expect(resolveEntityPoint('L_p2', [line])).toEqual({ x: 10, y: 0 });
  });

  it('resolves a circle by id and its center', () => {
    expect(resolveEntityPoint('C', [circle])).toEqual({ x: 5, y: 5 });
    expect(resolveEntityPoint('C_center', [circle])).toEqual({ x: 5, y: 5 });
  });

  it('resolves rectangle edge midpoints (l1=bottom, l2=right, l3=top, l4=left)', () => {
    expect(resolveEntityPoint('R_l1', [rect])).toEqual({ x: 5, y: 0 });
    expect(resolveEntityPoint('R_l2', [rect])).toEqual({ x: 10, y: 3 });
    expect(resolveEntityPoint('R_l3', [rect])).toEqual({ x: 5, y: 6 });
    expect(resolveEntityPoint('R_l4', [rect])).toEqual({ x: 0, y: 3 });
  });

  it('returns null for an unresolvable id (deleted element)', () => {
    expect(resolveEntityPoint('GONE_l1', [rect])).toBeNull();
  });
});

describe('constraintAnchor', () => {
  it('anchors a single-line relation at the line midpoint', () => {
    const c = { id: 'c1', type: 'horizontal_l', l_id: 'L' };
    expect(constraintAnchor(c, [line])).toEqual({ x: 5, y: 0 });
  });

  it('anchors a two-line relation at the average of both midpoints', () => {
    const l2: SketchElement = { type: SketchElementType.LINE, id: 'M', start: { x: 0, y: 4 }, end: { x: 4, y: 4 } };
    const c = { id: 'c1', type: 'parallel', l1_id: 'L', l2_id: 'M' };
    // L mid (5,0), M mid (2,4) → (3.5, 2)
    expect(constraintAnchor(c, [line, l2])).toEqual({ x: 3.5, y: 2 });
  });

  it('returns null when no referenced entity resolves', () => {
    expect(constraintAnchor({ id: 'c', type: 'horizontal_l', l_id: 'GONE' }, [line])).toBeNull();
  });
});

describe('constraintIconPlacements', () => {
  it('places each badge slightly above its entity midpoint', () => {
    const c = { id: 'c1', type: 'horizontal_l', l_id: 'L' };
    const [p] = constraintIconPlacements([c], [line], { offset: 3 });
    expect(p).toMatchObject({ id: 'c1', type: 'horizontal_l', x: 5, y: 3 }); // 0 + offset 3
  });

  it('stacks badges that share an anchor in a vertical column centered on the offset point', () => {
    const a = { id: 'a', type: 'horizontal_l', l_id: 'L' };
    const b = { id: 'b', type: 'p2p_distance', p1_id: 'L_p1', p2_id: 'L_p2' }; // also midpoint (5,0)
    const placed = constraintIconPlacements([a, b], [line], { offset: 3, spacing: 3 });
    // Centered on the single-badge offset point (5, 3): +/- half the spacing.
    expect(placed.map((p) => p.y)).toEqual([1.5, 4.5]);
    expect(placed.map((p) => p.x)).toEqual([5, 5]);
  });

  it('stacks badges on a vertical line vertically too, sharing one x (not diagonally)', () => {
    const vertical: SketchElement = { type: SketchElementType.LINE, id: 'V', start: { x: 0, y: 0 }, end: { x: 0, y: 10 } };
    const a = { id: 'a', type: 'vertical_l', l_id: 'V' };
    const b = { id: 'b', type: 'p2p_distance', p1_id: 'V_p1', p2_id: 'V_p2' };
    const placed = constraintIconPlacements([a, b], [vertical], { offset: 3, spacing: 3 });
    // Perpendicular offset from midpoint (0, 5) is sideways (x = -3); both badges must
    // share that same x — the stack itself always spreads in y, never diagonally.
    expect(placed.map((p) => p.x)).toEqual([-3, -3]);
    expect(placed.map((p) => p.y)).toEqual([3.5, 6.5]);
  });

  it('resolves an anchor and direction for a difference (horizontal/vertical-distance) constraint, whose references are nested under param1.o_id/param2.o_id instead of a top-level *_id field', () => {
    const vertical: SketchElement = { type: SketchElementType.LINE, id: 'V', start: { x: 0, y: 0 }, end: { x: 0, y: 10 } };
    const c = { id: 'c1', type: 'difference', param1: { o_id: 'V_p1', prop: 'y' }, param2: { o_id: 'V_p2', prop: 'y' } };
    const [p] = constraintIconPlacements([c], [vertical], { offset: 3 });
    expect(p).toMatchObject({ id: 'c1', y: 5 });
    expect(Math.abs(p.x)).toBeCloseTo(3); // perpendicular to the vertical line, not the (0,1) fallback
  });

  it('offsets a p2p_distance dimension on a rectangle edge outward, using the corner points directly (no l1..l4 edge sub-id is referenced by a distance constraint)', () => {
    // Left edge: corners p1 (0,0) and p4 (0,6). No `R_l4` id is ever referenced by
    // a distance constraint — only the two corner point ids — so this exercises the
    // two-point-direction path, not the edge-suffix path the badge functions used to
    // rely on exclusively.
    const left = { id: 'left', type: 'p2p_distance', p1_id: 'R_p1', p2_id: 'R_p4' };
    const [pLeft] = constraintIconPlacements([left], [rect], { offset: 3 });
    expect(pLeft.x).toBeLessThan(0); // outward = further left of the rectangle

    // Right edge: corners p2 (10,0) and p3 (10,6).
    const right = { id: 'right', type: 'p2p_distance', p1_id: 'R_p2', p2_id: 'R_p3' };
    const [pRight] = constraintIconPlacements([right], [rect], { offset: 3 });
    expect(pRight.x).toBeGreaterThan(10); // outward = further right of the rectangle
  });

  it('drops constraints whose entities were deleted', () => {
    const c = { id: 'c1', type: 'horizontal_l', l_id: 'GONE' };
    expect(constraintIconPlacements([c], [line])).toEqual([]);
  });

  it('places one badge per auto-constraint of a rectangle (4 distinct edges)', () => {
    const placed = constraintIconPlacements(inferAutoConstraints([rect]), [rect]);
    expect(placed).toHaveLength(4);
    // Each sits just outside its own edge, perpendicular to it — not always "above".
    expect(new Set(placed.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBe(4);
    const center = { x: 5, y: 3 };
    for (const p of placed) {
      expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeGreaterThan(5);
    }
  });

  it('offsets a vertical line badge sideways, not further up the line', () => {
    const vertical: SketchElement = { type: SketchElementType.LINE, id: 'V', start: { x: 0, y: 0 }, end: { x: 0, y: 10 } };
    const c = { id: 'c1', type: 'vertical_l', l_id: 'V' };
    const [p] = constraintIconPlacements([c], [vertical], { offset: 3 });
    // Midpoint is (0, 5); a vertical line's perpendicular is horizontal, so the
    // badge should shift in x, not climb further up the line in y.
    expect(p.y).toBeCloseTo(5);
    expect(Math.abs(p.x)).toBeCloseTo(3);
  });
});
