import { describe, it, expect } from 'vitest';
import {
  buildMidpointLine,
  buildCenterRectangle,
  centerRectangleGuides,
  buildThreePointCornerRectangle,
  buildThreePointCenterRectangle,
  buildParallelogram,
} from '@/cad/sketch/geometry/sketchShapeBuilders';

describe('buildMidpointLine', () => {
  it('keeps the first click as the midpoint of the resulting line', () => {
    const { start, end } = buildMidpointLine({ x: 0, y: 0 }, { x: 5, y: 0 });
    expect(end).toEqual({ x: 5, y: 0 });
    expect(start).toEqual({ x: -5, y: 0 });
    // midpoint of start/end is the original click
    expect({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }).toEqual({ x: 0, y: 0 });
  });
});

describe('buildCenterRectangle', () => {
  it('mirrors the corner through the center', () => {
    const { corner1, corner2 } = buildCenterRectangle({ x: 10, y: 10 }, { x: 13, y: 12 });
    expect(corner2).toEqual({ x: 13, y: 12 });
    expect(corner1).toEqual({ x: 7, y: 8 });
    // center is the midpoint of the two corners
    expect({ x: (corner1.x + corner2.x) / 2, y: (corner1.y + corner2.y) / 2 }).toEqual({ x: 10, y: 10 });
  });
});

describe('centerRectangleGuides', () => {
  it('returns two corner-to-corner diagonals that cross at the center', () => {
    const { diagonals, center } = centerRectangleGuides({ x: 0, y: 0 }, { x: 10, y: 6 });
    expect(center).toEqual({ x: 5, y: 3 });
    expect(diagonals).toEqual([
      [{ x: 0, y: 0 }, { x: 10, y: 6 }],
      [{ x: 10, y: 0 }, { x: 0, y: 6 }],
    ]);
    // Both diagonals' midpoints are the center.
    for (const [a, b] of diagonals) {
      expect({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }).toEqual(center);
    }
  });
});

describe('buildThreePointCornerRectangle', () => {
  it('builds an axis-aligned rectangle when the edge is along X', () => {
    const pts = buildThreePointCornerRectangle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 });
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 0, y: 4 },
    ]);
  });

  it('builds a rotated rectangle whose sides stay perpendicular', () => {
    // edge a->b at 45°, width point off to one side
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 10 };
    const c = { x: 0, y: 10 };
    const [p0, p1, p2, p3] = buildThreePointCornerRectangle(a, b, c);
    const e1 = { x: p1.x - p0.x, y: p1.y - p0.y };
    const e2 = { x: p3.x - p0.x, y: p3.y - p0.y };
    // adjacent sides are perpendicular
    expect(e1.x * e2.x + e1.y * e2.y).toBeCloseTo(0);
    // opposite side is parallel and equal length
    expect(p2.x - p1.x).toBeCloseTo(e2.x);
    expect(p2.y - p1.y).toBeCloseTo(e2.y);
  });
});

describe('buildThreePointCenterRectangle', () => {
  it('centers the rectangle on the first click', () => {
    const center = { x: 0, y: 0 };
    const pts = buildThreePointCenterRectangle(center, { x: 5, y: 0 }, { x: 0, y: 2 });
    expect(pts).toEqual([
      { x: 5, y: 2 },
      { x: 5, y: -2 },
      { x: -5, y: -2 },
      { x: -5, y: 2 },
    ]);
    // the four corners average back to the center
    const avg = pts.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
    expect(avg.x).toBeCloseTo(center.x);
    expect(avg.y).toBeCloseTo(center.y);
  });
});

describe('buildParallelogram', () => {
  it('closes the fourth corner so opposite edges are parallel', () => {
    const pts = buildParallelogram({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 13, y: 5 });
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 13, y: 5 },
      { x: 3, y: 5 },
    ]);
    const [a, b, c, d] = pts;
    // edge a->b parallel and equal to edge d->c
    expect({ x: b.x - a.x, y: b.y - a.y }).toEqual({ x: c.x - d.x, y: c.y - d.y });
  });
});
