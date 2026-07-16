import { describe, it, expect } from 'vitest';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import {
  ORIGIN_POINT_ID,
  makeOriginPrimitive,
  withOriginPrimitive,
  inferOriginCoincidence,
} from '@/cad/sketch/geometry/originPoint';

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

describe('inferOriginCoincidence', () => {
  it('binds a line endpoint at the origin to the origin point', () => {
    const line: SketchElement = {
      type: SketchElementType.LINE,
      id: 'L',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 5 },
    };
    expect(inferOriginCoincidence([line])).toEqual([
      { id: 'L_p1_origin_coincident', type: 'p2p_coincident', p1_id: 'L_p1', p2_id: ORIGIN_POINT_ID, auto: true },
    ]);
  });

  it('emits nothing when no anchor sits on the origin', () => {
    const line: SketchElement = {
      type: SketchElementType.LINE,
      id: 'L',
      start: { x: 1, y: 1 },
      end: { x: 10, y: 5 },
    };
    expect(inferOriginCoincidence([line])).toEqual([]);
  });

  it('binds a standalone point and a rectangle corner at the origin', () => {
    const point: SketchElement = { type: SketchElementType.POINT, id: 'PT', x: 0, y: 0 };
    const rect: SketchElement = {
      type: SketchElementType.RECTANGLE,
      id: 'R',
      corner1: { x: 0, y: 0 },
      corner2: { x: 10, y: 8 },
    };
    const out = inferOriginCoincidence([point, rect]);
    expect(out.map((c) => c.p1_id)).toEqual(['PT', 'R_p1']);
    expect(out.every((c) => c.p2_id === ORIGIN_POINT_ID && c.type === 'p2p_coincident')).toBe(true);
  });

  it('ignores construction (reference-only) lines', () => {
    const centerline: SketchElement = {
      type: SketchElementType.LINE,
      id: 'CL',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      construction: true,
    };
    expect(inferOriginCoincidence([centerline])).toEqual([]);
  });
});
