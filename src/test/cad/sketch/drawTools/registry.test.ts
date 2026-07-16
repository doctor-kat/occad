import { describe, it, expect } from 'vitest';
import { SketchElementType, SketchOperation } from '@/cad/types';
import { drawToolRegistry } from '@/cad/sketch/drawTools/registry';

const P = (x: number, y: number) => ({ x, y });

describe('drawToolRegistry — point', () => {
  it('completes immediately on the first click', () => {
    const tool = drawToolRegistry[SketchOperation.POINT]!;
    const result = tool.onClick({ points: [], snappedPoint: P(1, 2), sketchElements: [] });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0]).toMatchObject({ type: SketchElementType.POINT, x: 1, y: 2 });
    }
    expect(tool.onPreview({ points: [], snappedPoint: P(1, 2), sketchElements: [] })).toBeNull();
  });
});

describe('drawToolRegistry — line / centerline', () => {
  it('collects a start point then completes a line on the second click', () => {
    const tool = drawToolRegistry[SketchOperation.LINE]!;
    const first = tool.onClick({ points: [], snappedPoint: P(0, 0), sketchElements: [] });
    expect(first).toEqual({ kind: 'continue', points: [P(0, 0)] });

    const second = tool.onClick({ points: [P(0, 0)], snappedPoint: P(10, 0), sketchElements: [] });
    expect(second.kind).toBe('complete');
    if (second.kind === 'complete') {
      expect(second.elements[0]).toMatchObject({ type: SketchElementType.LINE, start: P(0, 0), end: P(10, 0) });
      expect(second.elements[0]).not.toHaveProperty('construction');
    }
  });

  it('marks the centerline variant as construction geometry', () => {
    const tool = drawToolRegistry[SketchOperation.CENTERLINE]!;
    const result = tool.onClick({ points: [P(0, 0)], snappedPoint: P(5, 5), sketchElements: [] });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.elements[0]).toMatchObject({ construction: true });
    }
  });

  it('previews a line only with exactly one point placed', () => {
    const tool = drawToolRegistry[SketchOperation.LINE]!;
    expect(tool.onPreview({ points: [], snappedPoint: P(1, 1), sketchElements: [] })).toBeNull();
    expect(tool.onPreview({ points: [P(0, 0)], snappedPoint: P(1, 1), sketchElements: [] })).toMatchObject({
      type: SketchElementType.LINE,
      start: P(0, 0),
      end: P(1, 1),
    });
  });
});

describe('drawToolRegistry — rectangle', () => {
  it('builds a rectangle from two opposite corners', () => {
    const tool = drawToolRegistry[SketchOperation.RECTANGLE]!;
    const result = tool.onClick({ points: [P(0, 0)], snappedPoint: P(10, 10), sketchElements: [] });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.elements[0]).toMatchObject({ type: SketchElementType.RECTANGLE, corner1: P(0, 0), corner2: P(10, 10) });
    }
  });

  it('center-rectangle emits the rectangle, its center point, and two construction diagonals as one group', () => {
    const tool = drawToolRegistry[SketchOperation.CENTER_RECTANGLE]!;
    const result = tool.onClick({ points: [P(0, 0)], snappedPoint: P(10, 10), sketchElements: [] });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.elements).toHaveLength(4);
      const [rect, center, diag1, diag2] = result.elements;
      expect(rect.type).toBe(SketchElementType.RECTANGLE);
      expect(center.type).toBe(SketchElementType.POINT);
      expect(diag1.type).toBe(SketchElementType.LINE);
      expect(diag2.type).toBe(SketchElementType.LINE);
      const groupId = (rect as { groupId?: string }).groupId;
      expect(groupId).toBeTruthy();
      expect((center as { groupId?: string }).groupId).toBe(groupId);
      expect((diag1 as { groupId?: string }).groupId).toBe(groupId);
      expect((diag2 as { groupId?: string }).groupId).toBe(groupId);
    }
  });

  it('three-point corner rectangle waits for 2 points before completing', () => {
    const tool = drawToolRegistry[SketchOperation.THREE_POINT_CORNER_RECTANGLE]!;
    const first = tool.onClick({ points: [], snappedPoint: P(0, 0), sketchElements: [] });
    expect(first).toEqual({ kind: 'continue', points: [P(0, 0)] });
    const second = tool.onClick({ points: [P(0, 0)], snappedPoint: P(10, 0), sketchElements: [] });
    expect(second).toEqual({ kind: 'continue', points: [P(0, 0), P(10, 0)] });
    const third = tool.onClick({ points: [P(0, 0), P(10, 0)], snappedPoint: P(10, 5), sketchElements: [] });
    expect(third.kind).toBe('complete');
    if (third.kind === 'complete') {
      expect(third.elements[0].type).toBe(SketchElementType.POLYGON);
    }
  });
});

describe('drawToolRegistry — circle', () => {
  it('computes the radius from center + circumference point', () => {
    const tool = drawToolRegistry[SketchOperation.CIRCLE]!;
    const result = tool.onClick({ points: [P(0, 0)], snappedPoint: P(3, 4), sketchElements: [] });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.elements[0]).toMatchObject({ type: SketchElementType.CIRCLE, center: P(0, 0), radius: 5 });
    }
  });

  it('perimeter circle completes with no elements when the three points are collinear', () => {
    const tool = drawToolRegistry[SketchOperation.PERIMETER_CIRCLE]!;
    const result = tool.onClick({ points: [P(0, 0), P(1, 0)], snappedPoint: P(2, 0), sketchElements: [] });
    expect(result).toEqual({ kind: 'complete', elements: [] });
  });
});

describe('drawToolRegistry — polygon', () => {
  it('never completes on click — always accumulates points', () => {
    const tool = drawToolRegistry[SketchOperation.POLYGON]!;
    const result = tool.onClick({ points: [P(0, 0), P(1, 0)], snappedPoint: P(1, 1), sketchElements: [] });
    expect(result).toEqual({ kind: 'continue', points: [P(0, 0), P(1, 0), P(1, 1)] });
    expect(tool.onPreview({ points: [P(0, 0)], snappedPoint: P(1, 1), sketchElements: [] })).toBeNull();
  });
});

describe('drawToolRegistry — arc', () => {
  it('three-point arc completes once 3 points are known', () => {
    const tool = drawToolRegistry[SketchOperation.ARC]!;
    const result = tool.onClick({ points: [P(0, 0), P(10, 0)], snappedPoint: P(5, 5), sketchElements: [] });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.elements[0]).toMatchObject({ type: SketchElementType.ARC, points: [P(0, 0), P(10, 0), P(5, 5)] });
    }
  });

  it('tangent arc falls back to +X tangent on an empty sketch', () => {
    const tool = drawToolRegistry[SketchOperation.TANGENT_ARC]!;
    const result = tool.onClick({ points: [P(0, 0)], snappedPoint: P(10, 10), sketchElements: [] });
    expect(result.kind).toBe('complete');
    if (result.kind === 'complete') {
      expect(result.elements[0].type).toBe(SketchElementType.ARC);
    }
  });
});
