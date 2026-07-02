import { describe, it, expect } from 'vitest';
import { pointPointDimensionLayout, pointLineDimensionLayout, axisDimensionLayout } from './dimensionLayout';

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

  it('flips arrow1 to point outward independently of arrow2', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { arrow1: true });
    // Tip stays anchored at the same witness point; only the chevron direction mirrors.
    expect(layout.arrow1[1]).toEqual(layout.dimLine[0]);
    expect(layout.arrow1[0].x).toBeGreaterThan(layout.dimLine[0].x);
    expect(layout.arrow1[2].x).toBeGreaterThan(layout.dimLine[0].x);
    // arrow2 is untouched.
    expect(layout.arrow2[0].x).toBeGreaterThan(layout.dimLine[1].x);
  });

  it('flips arrow2 to point outward independently of arrow1', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { arrow2: true });
    expect(layout.arrow2[1]).toEqual(layout.dimLine[1]);
    expect(layout.arrow2[0].x).toBeLessThan(layout.dimLine[1].x);
    expect(layout.arrow2[2].x).toBeLessThan(layout.dimLine[1].x);
    expect(layout.arrow1[0].x).toBeLessThan(layout.dimLine[0].x); // untouched
  });

  it('flips both arrows to point fully outward', () => {
    const layout = pointPointDimensionLayout({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { arrow1: true, arrow2: true });
    expect(layout.arrow1[0].x).toBeGreaterThan(layout.dimLine[0].x);
    expect(layout.arrow2[0].x).toBeLessThan(layout.dimLine[1].x);
  });
});
