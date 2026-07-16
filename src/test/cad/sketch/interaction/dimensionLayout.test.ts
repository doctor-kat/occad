import { describe, it, expect } from 'vitest';
import { pointPointDimensionLayout, pointLineDimensionLayout, axisDimensionLayout } from '@/cad/sketch/interaction/dimensionLayout';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('pointPointDimensionLayout', () => {
  it('shifts the dimension line perpendicular to p1->p2 by the offset', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 10, y: 0 };
    const layout = pointPointDimensionLayout(p1, p2, { x: 0, y: 5 });
    expect(layout.dimLine[0].y).toBeCloseTo(5);
    expect(layout.dimLine[1].y).toBeCloseTo(5);
    expect(layout.dimLine[0].x).toBeCloseTo(0);
    expect(layout.dimLine[1].x).toBeCloseTo(10);
  });

  it('places the label at the dimension line midpoint', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 });
    expect(layout.labelPos).toEqual({ x: 5, y: 5 });
  });

  it('splits the dimension line into two segments leaving a gap around the label, for a dimension long enough to fit one', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 });
    const [seg1, seg2] = layout.dimLineSegments;
    expect(seg1[0]).toEqual(layout.dimLine[0]); // starts at the same place the old single line did
    expect(seg2[1]).toEqual(layout.dimLine[1]); // ends at the same place
    // A real gap: segment 1 ends strictly before the label, segment 2 starts strictly after.
    expect(seg1[1].x).toBeLessThan(layout.labelPos.x);
    expect(seg2[0].x).toBeGreaterThan(layout.labelPos.x);
    // Symmetric around the label.
    expect(layout.labelPos.x - seg1[1].x).toBeCloseTo(seg2[0].x - layout.labelPos.x);
  });

  it('shrinks the gap (does not invert the segments) for a dimension shorter than the gap width', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 5 });
    const [seg1, seg2] = layout.dimLineSegments;
    // Still ordered correctly — segment 1's end must not overshoot past segment 2's start.
    expect(seg1[1].x).toBeLessThanOrEqual(seg2[0].x);
  });

  it('extension lines start at the original points', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 10, y: 0 };
    const layout = pointPointDimensionLayout(p1, p2, { x: 0, y: 5 });
    expect(layout.ext1[0]).toEqual(p1);
    expect(layout.ext2[0]).toEqual(p2);
  });

  it('arrows point inward toward each other along the dimension line', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 });
    // arrow1's tip is at dimLine[0] (the leading/forward point, facing dimLine[1]);
    // its wings trail behind, away from dimLine[1] (smaller x).
    expect(layout.arrow1[1]).toEqual(layout.dimLine[0]);
    expect(layout.arrow1[0].x).toBeLessThan(layout.dimLine[0].x);
    expect(layout.arrow1[2].x).toBeLessThan(layout.dimLine[0].x);
    expect(layout.arrow2[1]).toEqual(layout.dimLine[1]);
    expect(layout.arrow2[0].x).toBeGreaterThan(layout.dimLine[1].x);
    expect(layout.arrow2[2].x).toBeGreaterThan(layout.dimLine[1].x);
  });
});

describe('pointLineDimensionLayout', () => {
  it('measures the perpendicular distance from the point to the line', () => {
    const point = { x: 5, y: 8 };
    const lineStart = { x: 0, y: 0 };
    const lineEnd = { x: 10, y: 0 };
    const layout = pointLineDimensionLayout(point, lineStart, lineEnd, { x: 0, y: 0 });
    expect(dist(layout.dimLine[0], layout.dimLine[1])).toBeCloseTo(8);
  });
});

describe('axisDimensionLayout', () => {
  it('horizontal (x-axis) dimension runs extension lines vertically', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 10, y: 3 };
    const layout = axisDimensionLayout(p1, p2, 'x', { x: 0, y: 5 });
    expect(layout.dimLine[0]).toEqual({ x: 0, y: 5 });
    expect(layout.dimLine[1]).toEqual({ x: 10, y: 5 });
    expect(dist(layout.dimLine[0], layout.dimLine[1])).toBeCloseTo(10);
  });

  it('vertical (y-axis) dimension runs extension lines horizontally', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 10 };
    const layout = axisDimensionLayout(p1, p2, 'y', { x: 5, y: 0 });
    expect(layout.dimLine[0]).toEqual({ x: 5, y: 0 });
    expect(layout.dimLine[1]).toEqual({ x: 5, y: 10 });
    expect(dist(layout.dimLine[0], layout.dimLine[1])).toBeCloseTo(10);
  });
});

describe('arrow flip', () => {
  it('defaults to arrows pointing inward, toward each other', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 });
    // arrow1's tip is at dimLine[0], and its wings trail toward smaller x — i.e. the
    // chevron opens toward dimLine[1] (rightward, into the dimension). Flipping it
    // should mirror that: wings trail toward larger x instead.
    expect(layout.arrow1[0].x).toBeLessThan(layout.dimLine[0].x);
    expect(layout.arrow2[0].x).toBeGreaterThan(layout.dimLine[1].x);
  });

  it('flips both arrows together as a single inside/outside toggle for the whole dimension', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, true);
    // Tips stay anchored at the same witness points; only the chevron direction mirrors.
    expect(layout.arrow1[1]).toEqual(layout.dimLine[0]);
    expect(layout.arrow2[1]).toEqual(layout.dimLine[1]);
    expect(layout.arrow1[0].x).toBeGreaterThan(layout.dimLine[0].x);
    expect(layout.arrow2[0].x).toBeLessThan(layout.dimLine[1].x);
  });
});
