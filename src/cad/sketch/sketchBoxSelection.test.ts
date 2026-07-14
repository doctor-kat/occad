import { describe, it, expect } from 'vitest';
import {
  boxMode,
  rectFromCorners,
  selectElementsInBox,
  BoxMode,
} from './sketchBoxSelection';
import { SketchElementType } from '@/cad/types';
import type { SketchElement, Point2D } from '@/cad/types';

// Identity projection: plane coords == screen px. Keeps the geometry assertions
// readable; the real overlay supplies a camera-based projection.
const identity = (p: Point2D) => ({ x: p.x, y: p.y });

const line = (id: string, x1: number, y1: number, x2: number, y2: number): SketchElement => ({
  type: SketchElementType.LINE,
  id,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
});

const circle = (id: string, cx: number, cy: number, r: number): SketchElement => ({
  type: SketchElementType.CIRCLE,
  id,
  center: { x: cx, y: cy },
  radius: r,
});

const rectangle = (id: string, x1: number, y1: number, x2: number, y2: number): SketchElement => ({
  type: SketchElementType.RECTANGLE,
  id,
  corner1: { x: x1, y: y1 },
  corner2: { x: x2, y: y2 },
});

describe('boxMode', () => {
  it('drag right (endX >= startX) is window', () => {
    expect(boxMode(10, 50)).toBe(BoxMode.Window);
    expect(boxMode(10, 10)).toBe(BoxMode.Window);
  });

  it('drag left (endX < startX) is crossing', () => {
    expect(boxMode(50, 10)).toBe(BoxMode.Crossing);
  });
});

describe('selectElementsInBox — window mode (fully enclosed)', () => {
  it('selects a line fully inside the rect', () => {
    const el = line('a', 0, 0, 10, 0);
    const rect = rectFromCorners(-1, -1, 11, 1);
    expect(selectElementsInBox([el], rect, BoxMode.Window, identity)).toEqual(['a']);
  });

  it('does NOT select a line that pokes outside the rect', () => {
    const el = line('a', 0, 0, 10, 0);
    const rect = rectFromCorners(-1, -1, 5, 1); // misses the (10,0) end
    expect(selectElementsInBox([el], rect, BoxMode.Window, identity)).toEqual([]);
  });

  it('selects a circle whose whole extent is inside', () => {
    const el = circle('c', 0, 0, 5);
    const rect = rectFromCorners(-6, -6, 6, 6);
    expect(selectElementsInBox([el], rect, BoxMode.Window, identity)).toEqual(['c']);
  });

  it('does NOT select a circle that overhangs the rect', () => {
    const el = circle('c', 0, 0, 5);
    const rect = rectFromCorners(-3, -3, 3, 3); // smaller than the circle
    expect(selectElementsInBox([el], rect, BoxMode.Window, identity)).toEqual([]);
  });
});

describe('selectElementsInBox — crossing mode (touching)', () => {
  it('selects a line that merely crosses the rect edge', () => {
    const el = line('a', 0, 0, 10, 0);
    const rect = rectFromCorners(4, -1, 6, 1); // straddles the middle of the line
    expect(selectElementsInBox([el], rect, BoxMode.Crossing, identity)).toEqual(['a']);
  });

  it('selects a circle whose ring passes through the rect', () => {
    const el = circle('c', 0, 0, 5);
    const rect = rectFromCorners(4, -1, 6, 1); // straddles the +X side of the ring
    expect(selectElementsInBox([el], rect, BoxMode.Crossing, identity)).toEqual(['c']);
  });

  it('does NOT select a rect placed entirely in a circle interior (no contact)', () => {
    const el = circle('c', 0, 0, 5);
    const rect = rectFromCorners(-1, -1, 1, 1); // inside the ring, touches nothing
    expect(selectElementsInBox([el], rect, BoxMode.Crossing, identity)).toEqual([]);
  });

  it('does NOT select a line entirely outside the rect', () => {
    const el = line('a', 100, 100, 110, 100);
    const rect = rectFromCorners(0, 0, 10, 10);
    expect(selectElementsInBox([el], rect, BoxMode.Crossing, identity)).toEqual([]);
  });
});

describe('selectElementsInBox — multiple elements', () => {
  it('window returns only the fully-enclosed subset', () => {
    const inside = rectangle('in', 1, 1, 4, 4);
    const straddling = line('cross', 3, 3, 20, 3);
    const outside = circle('out', 100, 100, 2);
    const rect = rectFromCorners(0, 0, 10, 10);
    expect(selectElementsInBox([inside, straddling, outside], rect, BoxMode.Window, identity)).toEqual(['in']);
  });

  it('crossing returns the enclosed AND touching subset', () => {
    const inside = rectangle('in', 1, 1, 4, 4);
    const straddling = line('cross', 3, 3, 20, 3);
    const outside = circle('out', 100, 100, 2);
    const rect = rectFromCorners(0, 0, 10, 10);
    const ids = selectElementsInBox([inside, straddling, outside], rect, BoxMode.Crossing, identity);
    expect(ids.sort()).toEqual(['cross', 'in']);
  });
});
