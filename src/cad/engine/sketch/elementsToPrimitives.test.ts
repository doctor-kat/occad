import { describe, it, expect } from 'vitest';
import { mapElementsToPrimitives } from './elementsToPrimitives';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';

describe('mapElementsToPrimitives', () => {
  it('maps a line to two points + a line referencing them', () => {
    const line: SketchElement = {
      type: SketchElementType.LINE,
      id: 'L',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    };
    const prims = mapElementsToPrimitives([line]);
    expect(prims).toEqual([
      { id: 'L_p1', type: 'point', fixed: false, data: { x: 0, y: 0 } },
      { id: 'L_p2', type: 'point', fixed: false, data: { x: 10, y: 0 } },
      { id: 'L', type: 'line', fixed: false, data: { p1_id: 'L_p1', p2_id: 'L_p2' } },
    ]);
  });

  it('maps a circle to a center point + a circle (planegcs c_id)', () => {
    const circle: SketchElement = {
      type: SketchElementType.CIRCLE,
      id: 'C',
      center: { x: 5, y: 5 },
      radius: 3,
    };
    const prims = mapElementsToPrimitives([circle]);
    expect(prims).toContainEqual({ id: 'C_center', type: 'point', fixed: false, data: { x: 5, y: 5 } });
    // planegcs reads the center point via `c_id` (not `center_id`) — using the
    // wrong key meant circles silently never reached the solver.
    expect(prims).toContainEqual({ id: 'C', type: 'circle', fixed: false, data: { c_id: 'C_center', radius: 3 } });
  });

  // Regression: rectangle mapping previously threw `ReferenceError: p3_id is not defined`
  // (typo for p3Id/p4Id) — a runtime-only failure the build never caught.
  it('maps a rectangle to 4 points + 4 closed lines without throwing', () => {
    const rect: SketchElement = {
      type: SketchElementType.RECTANGLE,
      id: 'R',
      corner1: { x: 0, y: 0 },
      corner2: { x: 4, y: 2 },
    };

    expect(() => mapElementsToPrimitives([rect])).not.toThrow();
    const prims = mapElementsToPrimitives([rect]);

    // 4 corner points (CCW from corner1)
    expect(prims).toContainEqual({ id: 'R_p1', type: 'point', fixed: false, data: { x: 0, y: 0 } });
    expect(prims).toContainEqual({ id: 'R_p2', type: 'point', fixed: false, data: { x: 4, y: 0 } });
    expect(prims).toContainEqual({ id: 'R_p3', type: 'point', fixed: false, data: { x: 4, y: 2 } });
    expect(prims).toContainEqual({ id: 'R_p4', type: 'point', fixed: false, data: { x: 0, y: 2 } });

    // 4 lines forming a closed loop p1->p2->p3->p4->p1
    const lines = prims.filter((p) => p.type === 'line');
    expect(lines.map((l) => [l.data.p1_id, l.data.p2_id])).toEqual([
      ['R_p1', 'R_p2'],
      ['R_p2', 'R_p3'],
      ['R_p3', 'R_p4'],
      ['R_p4', 'R_p1'],
    ]);
  });

  it('skips construction lines (centerlines) so they never reach the profile wire', () => {
    const centerline: SketchElement = {
      type: SketchElementType.LINE,
      id: 'CL',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      construction: true,
    };
    expect(mapElementsToPrimitives([centerline])).toEqual([]);
  });

  it('maps a center-based arc to its center point + arc with real radius/angles', () => {
    // Centerpoint/tangent arcs carry center + radius + angles (not 3 points), so
    // the mapping must forward those real values, not the old hardcoded defaults.
    const arc: SketchElement = {
      type: SketchElementType.ARC,
      id: 'A',
      center: { x: 2, y: 3 },
      radius: 7,
      startAngle: 0,
      endAngle: Math.PI / 2,
    } as SketchElement;
    const prims = mapElementsToPrimitives([arc]);
    expect(prims).toContainEqual({ id: 'A_center', type: 'point', fixed: false, data: { x: 2, y: 3 } });
    const arcPrim = prims.find((p) => p.type === 'arc');
    expect(arcPrim).toMatchObject({
      id: 'A',
      data: { center_id: 'A_center', radius: 7, start_angle: 0, end_angle: Math.PI / 2 },
    });
  });

  it('maps a polygon to N points + N closed lines', () => {
    const poly: SketchElement = {
      type: SketchElementType.POLYGON,
      id: 'P',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ],
    };
    const prims = mapElementsToPrimitives([poly]);
    expect(prims.filter((p) => p.type === 'point')).toHaveLength(3);
    const lines = prims.filter((p) => p.type === 'line');
    expect(lines).toHaveLength(3);
    // last line wraps back to the first point
    expect([lines[2].data.p1_id, lines[2].data.p2_id]).toEqual(['P_p2', 'P_p0']);
  });
});
