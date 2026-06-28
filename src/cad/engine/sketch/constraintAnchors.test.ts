import { describe, it, expect } from 'vitest';
import { resolveEntityPoint, constraintAnchor, constraintIconPlacements } from './constraintAnchors';
import { inferAutoConstraints } from './autoConstraints';
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

  it('stacks badges that share an anchor so they do not overlap', () => {
    const a = { id: 'a', type: 'horizontal_l', l_id: 'L' };
    const b = { id: 'b', type: 'p2p_distance', p1_id: 'L_p1', p2_id: 'L_p2' }; // also midpoint (5,0)
    const placed = constraintIconPlacements([a, b], [line], { offset: 3, spacing: 3 });
    expect(placed.map((p) => p.y)).toEqual([3, 6]); // stacked upward
  });

  it('drops constraints whose entities were deleted', () => {
    const c = { id: 'c1', type: 'horizontal_l', l_id: 'GONE' };
    expect(constraintIconPlacements([c], [line])).toEqual([]);
  });

  it('places one badge per auto-constraint of a rectangle (4 distinct edges)', () => {
    const placed = constraintIconPlacements(inferAutoConstraints([rect]), [rect]);
    expect(placed).toHaveLength(4);
    // Each sits above a distinct edge midpoint; x of the two horizontals is the edge center.
    const ys = placed.map((p) => Math.round(p.y));
    // bottom edge y=0→3, top edge y=6→9, side edges y=3→6
    expect(new Set(placed.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBe(4);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(3);
  });
});
