import { describe, it, expect } from 'vitest';
import { projectPointOntoLineSegment, getDistanceToElement } from './elementHitTest';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';

describe('projectPointOntoLineSegment', () => {
  it('projects onto the middle of a segment', () => {
    const { projection, distance } = projectPointOntoLineSegment(
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(projection).toEqual({ x: 5, y: 0 });
    expect(distance).toBe(5);
  });

  it('clamps to the nearest endpoint beyond the segment', () => {
    const { projection, distance } = projectPointOntoLineSegment(
      { x: 20, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(projection).toEqual({ x: 10, y: 0 });
    expect(distance).toBe(10);
  });

  it('handles a zero-length segment', () => {
    const { projection, distance } = projectPointOntoLineSegment(
      { x: 3, y: 4 },
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    );
    expect(projection).toEqual({ x: 0, y: 0 });
    expect(distance).toBe(5);
  });
});

describe('getDistanceToElement', () => {
  it('measures distance to a point element', () => {
    const el: SketchElement = { type: SketchElementType.POINT, id: 'p1', x: 3, y: 4 };
    expect(getDistanceToElement({ x: 0, y: 0 }, el)).toBe(5);
  });

  it('measures distance to a line element', () => {
    const el: SketchElement = {
      type: SketchElementType.LINE,
      id: 'l1',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    };
    expect(getDistanceToElement({ x: 5, y: 3 }, el)).toBe(3);
  });

  it('measures distance to a circle element as distance to its boundary', () => {
    const el: SketchElement = {
      type: SketchElementType.CIRCLE,
      id: 'c1',
      center: { x: 0, y: 0 },
      radius: 5,
    };
    expect(getDistanceToElement({ x: 10, y: 0 }, el)).toBe(5);
    expect(getDistanceToElement({ x: 0, y: 0 }, el)).toBe(5);
  });

  it('measures distance to a rectangle as distance to nearest edge', () => {
    const el: SketchElement = {
      type: SketchElementType.RECTANGLE,
      id: 'r1',
      corner1: { x: 0, y: 0 },
      corner2: { x: 10, y: 10 },
    };
    expect(getDistanceToElement({ x: 5, y: 0 }, el)).toBe(0);
    expect(getDistanceToElement({ x: 5, y: 5 }, el)).toBe(5);
  });

  it('measures distance to a polygon as distance to nearest edge', () => {
    const el: SketchElement = {
      type: SketchElementType.POLYGON,
      id: 'poly1',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }],
    };
    expect(getDistanceToElement({ x: 5, y: 0 }, el)).toBe(0);
  });

  it('returns Infinity for a degenerate polygon', () => {
    const el: SketchElement = { type: SketchElementType.POLYGON, id: 'poly2', points: [{ x: 0, y: 0 }] };
    expect(getDistanceToElement({ x: 5, y: 5 }, el)).toBe(Infinity);
  });

  it('measures distance to a center-based arc as distance to its circle', () => {
    const el: SketchElement = {
      type: SketchElementType.ARC,
      id: 'a1',
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: 0,
      endAngle: Math.PI,
    };
    expect(getDistanceToElement({ x: 10, y: 0 }, el)).toBe(5);
  });

  it('measures distance to a three-point arc as nearest control point distance', () => {
    const el: SketchElement = {
      type: SketchElementType.ARC,
      id: 'a2',
      points: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }],
    };
    expect(getDistanceToElement({ x: 0, y: 0 }, el)).toBe(0);
  });
});
