import { describe, it, expect } from 'vitest';
import { pickLoop } from '@/cad/solid/edgeLoop';

describe('pickLoop', () => {
  const wires = [
    [0, 1, 2, 3], // face A boundary
    [4, 5, 6, 7], // face B boundary
    [2, 8, 9],    // face C, sharing edge 2 with A
  ];

  it('returns the loop containing the picked edge', () => {
    expect(pickLoop(wires, 5)).toEqual([4, 5, 6, 7]);
  });

  it('returns the first wire when the edge is shared', () => {
    expect(pickLoop(wires, 2)).toEqual([0, 1, 2, 3]);
  });

  it('falls back to the picked edge alone when no wire contains it', () => {
    expect(pickLoop(wires, 42)).toEqual([42]);
  });

  it('de-dupes repeated edges within a wire', () => {
    expect(pickLoop([[1, 2, 2, 3]], 2)).toEqual([1, 2, 3]);
  });
});
