import { describe, it, expect } from 'vitest';
import { midpointOf, midpointPointId, withMidpointPoint } from '@/frontend/viewport/contextMenu/sketchMidpoint';
import { SketchElementType, type SketchElement } from '@/cad/types';

const line: SketchElement = {
  type: SketchElementType.LINE, id: 'L1',
  start: { x: 0, y: 0 }, end: { x: 10, y: 4 },
};
const circle: SketchElement = {
  type: SketchElementType.CIRCLE, id: 'C1', center: { x: 1, y: 1 }, radius: 2,
} as SketchElement;

describe('midpointOf', () => {
  it('returns the midpoint of a straight line', () => {
    expect(midpointOf(line)).toEqual({ x: 5, y: 2 });
  });
  it('returns null for a non-line element', () => {
    expect(midpointOf(circle)).toBeNull();
  });
});

describe('withMidpointPoint', () => {
  it('appends a construction point at the line midpoint and returns its id', () => {
    const { elements, pointId } = withMidpointPoint([line], 'L1');
    expect(pointId).toBe(midpointPointId('L1'));
    const pt = elements.find((e) => e.id === pointId);
    expect(pt).toMatchObject({ type: SketchElementType.POINT, x: 5, y: 2 });
    expect(elements).toHaveLength(2);
  });

  it('is idempotent — reuses the existing midpoint point', () => {
    const first = withMidpointPoint([line], 'L1');
    const second = withMidpointPoint(first.elements, 'L1');
    expect(second.pointId).toBe(first.pointId);
    expect(second.elements).toBe(first.elements); // unchanged reference
    expect(second.elements).toHaveLength(2);
  });

  it('returns elements unchanged with null id for a non-line', () => {
    const { elements, pointId } = withMidpointPoint([circle], 'C1');
    expect(pointId).toBeNull();
    expect(elements).toHaveLength(1);
  });
});
