import { describe, it, expect } from 'vitest';
import { resolveContextTarget, computeSketchChain, type ContextTargetInput } from './contextTarget';
import { SketchElementType, type SketchElement } from '@/cad/types';

const base: ContextTargetInput = {
  inSketchMode: false,
  hoveredFaceId: null,
  hoveredEdgeIndex: null,
  hoveredSketchElementId: null,
  selectedFaceId: null,
  selectedEdgeIndex: null,
  selectedSketchElementIds: [],
};

describe('resolveContextTarget', () => {
  it('targets a hovered face', () => {
    expect(resolveContextTarget({ ...base, hoveredFaceId: 3 })).toEqual({ kind: 'face', faceId: 3 });
  });

  it('prefers a hovered face over a hovered edge', () => {
    expect(resolveContextTarget({ ...base, hoveredFaceId: 1, hoveredEdgeIndex: 2 })).toEqual({
      kind: 'face',
      faceId: 1,
    });
  });

  it('targets a hovered edge when no face is hovered', () => {
    expect(resolveContextTarget({ ...base, hoveredEdgeIndex: 5 })).toEqual({ kind: 'edge', edgeIndex: 5 });
  });

  it('falls back to the selected face on empty space (right-click nothing with a selection)', () => {
    expect(resolveContextTarget({ ...base, selectedFaceId: 7 })).toEqual({ kind: 'face', faceId: 7 });
  });

  it('falls back to the selected edge on empty space', () => {
    expect(resolveContextTarget({ ...base, selectedEdgeIndex: 4 })).toEqual({ kind: 'edge', edgeIndex: 4 });
  });

  it('resolves empty space with no selection to the camera menu', () => {
    expect(resolveContextTarget(base)).toEqual({ kind: 'camera' });
  });

  it('faceId 0 is a valid target (not treated as empty)', () => {
    expect(resolveContextTarget({ ...base, hoveredFaceId: 0 })).toEqual({ kind: 'face', faceId: 0 });
  });

  describe('sketch mode', () => {
    const sketchBase = { ...base, inSketchMode: true };

    it('targets a hovered sketch entity', () => {
      expect(resolveContextTarget({ ...sketchBase, hoveredSketchElementId: 'e1' })).toEqual({
        kind: 'sketch-entity',
        elementId: 'e1',
      });
    });

    it('falls back to the first selected sketch entity', () => {
      expect(resolveContextTarget({ ...sketchBase, selectedSketchElementIds: ['a', 'b'] })).toEqual({
        kind: 'sketch-entity',
        elementId: 'a',
      });
    });

    it('ignores solid faces/edges while sketching', () => {
      expect(resolveContextTarget({ ...sketchBase, hoveredFaceId: 2, selectedEdgeIndex: 9 })).toEqual({
        kind: 'camera',
      });
    });
  });
});

const line = (id: string, start: [number, number], end: [number, number]): SketchElement => ({
  type: SketchElementType.LINE,
  id,
  start: { x: start[0], y: start[1] },
  end: { x: end[0], y: end[1] },
});

describe('computeSketchChain', () => {
  it('walks connected lines through shared endpoints', () => {
    const els = [
      line('a', [0, 0], [10, 0]),
      line('b', [10, 0], [10, 10]),
      line('c', [10, 10], [0, 10]),
    ];
    expect(new Set(computeSketchChain(els, 'a'))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('excludes a disconnected line', () => {
    const els = [
      line('a', [0, 0], [10, 0]),
      line('b', [10, 0], [10, 10]),
      line('far', [100, 100], [110, 100]),
    ];
    expect(new Set(computeSketchChain(els, 'a'))).toEqual(new Set(['a', 'b']));
  });

  it('a closed shape (no free endpoints) is its own chain', () => {
    const els: SketchElement[] = [
      { type: SketchElementType.CIRCLE, id: 'circ', center: { x: 0, y: 0 }, radius: 5 },
      line('a', [0, 0], [10, 0]),
    ];
    expect(computeSketchChain(els, 'circ')).toEqual(['circ']);
  });

  it('returns [] for an unknown id', () => {
    expect(computeSketchChain([line('a', [0, 0], [1, 0])], 'nope')).toEqual([]);
  });

  it('preserves original element order in the result', () => {
    const els = [
      line('a', [0, 0], [10, 0]),
      line('b', [10, 0], [10, 10]),
      line('c', [10, 10], [20, 10]),
    ];
    expect(computeSketchChain(els, 'b')).toEqual(['a', 'b', 'c']);
  });
});
