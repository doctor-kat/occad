import { describe, it, expect } from 'vitest';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import { syncElementsFromPrimitives } from './syncElementsFromPrimitives';
import type { SketchPrimitiveDTO } from './elementsToPrimitives';
import { mapElementsToPrimitives } from './elementsToPrimitives';

const pt = (id: string, x: number, y: number): SketchPrimitiveDTO => ({ id, type: 'point', fixed: false, data: { x, y } });

describe('syncElementsFromPrimitives', () => {
  it('rewrites a rectangle element from its solved corner primitives (the reported bug)', () => {
    const rect: SketchElement = {
      type: SketchElementType.RECTANGLE,
      id: 'R',
      corner1: { x: 0, y: 0 },
      corner2: { x: 10, y: 10 },
    } as SketchElement;

    // Solver moved the rectangle wider (e.g. a driving Horiz. Distance dimension edit).
    const primitives = mapElementsToPrimitives([rect]).map((p) =>
      p.id === 'R_p2' ? { ...p, data: { x: 20, y: 0 } }
        : p.id === 'R_p3' ? { ...p, data: { x: 20, y: 10 } }
        : p
    );

    const [synced] = syncElementsFromPrimitives([rect], primitives) as [any];
    expect(synced.corner1).toEqual({ x: 0, y: 0 });
    expect(synced.corner2).toEqual({ x: 20, y: 10 });
  });

  it('rewrites a line element from its solved endpoints', () => {
    const line: SketchElement = { type: SketchElementType.LINE, id: 'L', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } as SketchElement;
    const primitives = [pt('L_p1', 0, 0), pt('L_p2', 15, 0), { id: 'L', type: 'line', fixed: false, data: { p1_id: 'L_p1', p2_id: 'L_p2' } } as SketchPrimitiveDTO];
    const [synced] = syncElementsFromPrimitives([line], primitives) as [any];
    expect(synced.end).toEqual({ x: 15, y: 0 });
  });

  it('leaves a construction line untouched (no primitives are minted for it)', () => {
    const line: SketchElement = { type: SketchElementType.LINE, id: 'L', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, construction: true } as SketchElement;
    const [synced] = syncElementsFromPrimitives([line], []) as [any];
    expect(synced).toBe(line);
  });

  it('rewrites a circle element from its solved center + radius', () => {
    const circle: SketchElement = { type: SketchElementType.CIRCLE, id: 'C', center: { x: 0, y: 0 }, radius: 5 } as SketchElement;
    const primitives = [pt('C_center', 2, 3), { id: 'C', type: 'circle', fixed: false, data: { c_id: 'C_center', radius: 8 } } as SketchPrimitiveDTO];
    const [synced] = syncElementsFromPrimitives([circle], primitives) as [any];
    expect(synced.center).toEqual({ x: 2, y: 3 });
    expect(synced.radius).toBe(8);
  });

  it('falls back to the original element when no matching primitive exists', () => {
    const circle: SketchElement = { type: SketchElementType.CIRCLE, id: 'C', center: { x: 0, y: 0 }, radius: 5 } as SketchElement;
    const [synced] = syncElementsFromPrimitives([circle], []) as [any];
    expect(synced).toBe(circle);
  });
});
