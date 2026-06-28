import { describe, it, expect } from 'vitest';
import {
  circleFromThreePoints,
  arcFromThreePoints,
  centerpointArc,
  tangentArc,
  type ArcGeometry,
} from './arcGeometry';

const TWO_PI = Math.PI * 2;

/** Point on an arc at the given CCW parameter. */
function pointAt(arc: ArcGeometry, angle: number) {
  return {
    x: arc.center.x + Math.cos(angle) * arc.radius,
    y: arc.center.y + Math.sin(angle) * arc.radius,
  };
}

describe('circleFromThreePoints', () => {
  it('finds the circumcircle of three points on the unit circle', () => {
    const c = circleFromThreePoints({ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 });
    expect(c).not.toBeNull();
    expect(c!.center.x).toBeCloseTo(0);
    expect(c!.center.y).toBeCloseTo(0);
    expect(c!.radius).toBeCloseTo(1);
  });

  it('finds an off-origin circle', () => {
    // circle centered (5,5) r=5: points (10,5),(5,10),(0,5)
    const c = circleFromThreePoints({ x: 10, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 5 });
    expect(c!.center.x).toBeCloseTo(5);
    expect(c!.center.y).toBeCloseTo(5);
    expect(c!.radius).toBeCloseTo(5);
  });

  it('returns null for collinear points', () => {
    expect(circleFromThreePoints({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
});

describe('centerpointArc', () => {
  it('builds an arc with radius from center to start, sweeping CCW to end', () => {
    const arc = centerpointArc({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 });
    expect(arc).not.toBeNull();
    expect(arc!.center).toEqual({ x: 0, y: 0 });
    expect(arc!.radius).toBeCloseTo(10);
    expect(arc!.startAngle).toBeCloseTo(0);
    // CCW from 0 to the end direction (90deg)
    expect(arc!.endAngle).toBeCloseTo(Math.PI / 2);
    // endpoints lie on the circle at start/end angles
    expect(pointAt(arc!, arc!.startAngle)).toMatchObject({ x: expect.closeTo(10), y: expect.closeTo(0) });
    expect(pointAt(arc!, arc!.endAngle)).toMatchObject({ x: expect.closeTo(0), y: expect.closeTo(10) });
  });

  it('projects the end click onto the radius circle (radius set by the start click)', () => {
    // start sets radius 10; end is far away at angle 90deg
    const arc = centerpointArc({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 50 });
    expect(arc!.radius).toBeCloseTo(10);
    expect(arc!.endAngle).toBeCloseTo(Math.PI / 2);
  });

  it('endAngle is always greater than startAngle (CCW normalized)', () => {
    // end is clockwise from start; CCW normalization wraps it past startAngle
    const arc = centerpointArc({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -10 });
    expect(arc!.endAngle).toBeGreaterThan(arc!.startAngle);
    expect(arc!.endAngle - arc!.startAngle).toBeCloseTo(1.5 * Math.PI);
  });

  it('returns null when the start coincides with the center', () => {
    expect(centerpointArc({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });
});

describe('arcFromThreePoints', () => {
  it('passes through all three points (CCW order)', () => {
    // unit circle, p1=(1,0) start, p2=(0,1) mid, p3=(-1,0) end → CCW half
    const arc = arcFromThreePoints({ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 });
    expect(arc).not.toBeNull();
    expect(arc!.radius).toBeCloseTo(1);
    expect(arc!.startAngle).toBeCloseTo(0);
    expect(arc!.endAngle).toBeCloseTo(Math.PI);
    // the mid angle (pi/2) lies within [start,end]
    const midA = Math.PI / 2;
    expect(midA).toBeGreaterThan(arc!.startAngle);
    expect(midA).toBeLessThan(arc!.endAngle);
  });

  it('handles a clockwise traversal by anchoring the CCW sweep on the far endpoint', () => {
    // p1=(1,0), mid=(0,-1), p3=(-1,0): the arc goes through the bottom (CW from p1)
    const arc = arcFromThreePoints({ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 });
    expect(arc!.radius).toBeCloseTo(1);
    // The CCW-normalized arc must include the mid point's angle (-pi/2 ≡ 3pi/2)
    const span = arc!.endAngle - arc!.startAngle;
    expect(span).toBeCloseTo(Math.PI);
    // sample the midpoint of the parametric sweep: should be near (0,-1)
    const mid = pointAt(arc!, (arc!.startAngle + arc!.endAngle) / 2);
    expect(mid.x).toBeCloseTo(0);
    expect(mid.y).toBeCloseTo(-1);
  });

  it('returns null for collinear points', () => {
    expect(arcFromThreePoints({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });
});

describe('tangentArc', () => {
  it('is tangent to the given direction at the start point', () => {
    // start (0,0), tangent +X, end (10,10). The center must lie on the line x=0 (perp to tangent).
    const arc = tangentArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 10, y: 10 });
    expect(arc).not.toBeNull();
    // center is directly above/below the start (perpendicular to +X tangent)
    expect(arc!.center.x).toBeCloseTo(0);
    // |center - start| == |center - end| == radius
    const dStart = Math.hypot(arc!.center.x - 0, arc!.center.y - 0);
    const dEnd = Math.hypot(arc!.center.x - 10, arc!.center.y - 10);
    expect(dStart).toBeCloseTo(arc!.radius);
    expect(dEnd).toBeCloseTo(arc!.radius);
  });

  it('produces a quarter circle for a right-angle case', () => {
    // start (0,0) tangent +X, end (10,10): center (0,10), r=10, quarter arc
    const arc = tangentArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 10, y: 10 });
    expect(arc!.center.x).toBeCloseTo(0);
    expect(arc!.center.y).toBeCloseTo(10);
    expect(arc!.radius).toBeCloseTo(10);
    // sweep CCW start->end traces a quarter circle through the tangent direction
    const startPt = pointAt(arc!, arc!.startAngle);
    const endPt = pointAt(arc!, arc!.endAngle);
    const corners = [startPt, endPt];
    expect(corners).toContainEqual({ x: expect.closeTo(0), y: expect.closeTo(0) });
    expect(corners).toContainEqual({ x: expect.closeTo(10), y: expect.closeTo(10) });
    expect(Math.abs(arc!.endAngle - arc!.startAngle)).toBeCloseTo(Math.PI / 2);
  });

  it('normalizes endAngle above startAngle (CCW sweep)', () => {
    const arc = tangentArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 10, y: 10 });
    expect(arc!.endAngle).toBeGreaterThan(arc!.startAngle);
    expect(arc!.endAngle - arc!.startAngle).toBeLessThanOrEqual(TWO_PI);
  });

  it('returns null when the end lies on the tangent line (infinite radius)', () => {
    expect(tangentArc({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 10, y: 0 })).toBeNull();
  });
});
