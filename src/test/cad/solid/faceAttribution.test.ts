import { describe, it, expect } from 'vitest';
import { attributeFaceOwners, EMPTY_OWNERSHIP } from '@/cad/solid/faceAttribution';
import type { Fingerprint } from '@/cad/types';

// A fingerprint far enough from any other (distinct centroid) that it never
// matches — used to synthesize "new" faces. Uses a plane so kind/geomType agree.
function fp(x: number, measure = 1): Fingerprint {
  return { kind: 'face', index: 0, geomType: 'plane', measure, centroid: { x, y: 0, z: 0 }, obb: [1, 1, 1] };
}

describe('attributeFaceOwners', () => {
  it('attributes every face of the first feature to it (empty prior state)', () => {
    const next = attributeFaceOwners(EMPTY_OWNERSHIP, [fp(0), fp(100), fp(200)], 'f1');
    expect(next.owners).toEqual(['f1', 'f1', 'f1']);
  });

  it('surviving faces keep their owner; new faces belong to the running feature', () => {
    const first = attributeFaceOwners(EMPTY_OWNERSHIP, [fp(0), fp(100)], 'f1');
    // f2 keeps the two existing faces (same fingerprints) and adds two new ones.
    const second = attributeFaceOwners(first, [fp(0), fp(100), fp(500), fp(600)], 'f2');
    expect(second.owners).toEqual(['f1', 'f1', 'f2', 'f2']);
  });

  it('a feature that leaves the body unchanged re-attributes nothing', () => {
    const first = attributeFaceOwners(EMPTY_OWNERSHIP, [fp(0), fp(100)], 'f1');
    const second = attributeFaceOwners(first, [fp(0), fp(100)], 'f2');
    expect(second.owners).toEqual(['f1', 'f1']);
  });

  it('carries the new fingerprints forward for the next step', () => {
    const next = attributeFaceOwners(EMPTY_OWNERSHIP, [fp(0)], 'f1');
    expect(next.fps).toHaveLength(1);
    expect(next.fps[0].centroid.x).toBe(0);
  });
});
