import { describe, it, expect } from 'vitest';
import { ORIGIN_POINT_ID, makeOriginPrimitive, withOriginPrimitive } from './originPoint';

describe('originPoint', () => {
  it('makes a fixed origin point primitive at (0,0)', () => {
    expect(makeOriginPrimitive()).toEqual({
      id: ORIGIN_POINT_ID,
      type: 'point',
      fixed: true,
      data: { x: 0, y: 0 },
    });
  });

  it('prepends the origin to a primitive list', () => {
    const prims = [{ id: 'L_p1', type: 'point', fixed: false, data: { x: 1, y: 2 } }];
    const out = withOriginPrimitive(prims);
    expect(out[0]).toEqual(makeOriginPrimitive());
    expect(out).toHaveLength(2);
  });

  it('replaces any pre-existing origin so it never duplicates or drifts', () => {
    const drifted = [
      { id: ORIGIN_POINT_ID, type: 'point', fixed: false, data: { x: 99, y: 99 } },
      { id: 'L_p1', type: 'point', fixed: false, data: { x: 1, y: 2 } },
    ];
    const out = withOriginPrimitive(drifted);
    expect(out.filter((p) => p.id === ORIGIN_POINT_ID)).toEqual([makeOriginPrimitive()]);
    expect(out).toHaveLength(2);
  });
});
