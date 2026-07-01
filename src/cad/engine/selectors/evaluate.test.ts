import { describe, it, expect } from 'vitest';
import { parse } from './grammar';
import { evaluate } from './evaluate';
import { selectSubShapes } from './index';
import type { SubShapeDescriptor, Vec3 } from './types';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/**
 * Descriptors for a unit box [0,1]^3: 6 planar faces (indices 0–5) with
 * axis-aligned outward normals, then 12 line edges (indices 6–17) directed along
 * X/Y/Z. Enough to exercise every directional/type predicate.
 */
function boxDescriptors(): SubShapeDescriptor[] {
  const faces: SubShapeDescriptor[] = [
    { index: 0, kind: 'face', geomType: 'plane', measure: 1, centroid: v(0.5, 0.5, 1), obb: [0, 0.5, 0.5], direction: v(0, 0, 1) },  // top
    { index: 1, kind: 'face', geomType: 'plane', measure: 1, centroid: v(0.5, 0.5, 0), obb: [0, 0.5, 0.5], direction: v(0, 0, -1) }, // bottom
    { index: 2, kind: 'face', geomType: 'plane', measure: 1, centroid: v(1, 0.5, 0.5), obb: [0, 0.5, 0.5], direction: v(1, 0, 0) },  // +X
    { index: 3, kind: 'face', geomType: 'plane', measure: 1, centroid: v(0, 0.5, 0.5), obb: [0, 0.5, 0.5], direction: v(-1, 0, 0) }, // -X
    { index: 4, kind: 'face', geomType: 'plane', measure: 1, centroid: v(0.5, 1, 0.5), obb: [0, 0.5, 0.5], direction: v(0, 1, 0) },  // +Y
    { index: 5, kind: 'face', geomType: 'plane', measure: 1, centroid: v(0.5, 0, 0.5), obb: [0, 0.5, 0.5], direction: v(0, -1, 0) }, // -Y
  ];
  // 4 edges directed along Z (the "vertical" edges), at the 4 XY corners.
  const zEdges: SubShapeDescriptor[] = [
    [6, 0, 0], [7, 1, 0], [8, 0, 1], [9, 1, 1],
  ].map(([index, x, y]) => ({
    index, kind: 'edge', geomType: 'line', measure: 1,
    centroid: v(x, y, 0.5), obb: [0, 0, 0.5], direction: v(0, 0, 1),
  }));
  // 4 edges along X + 4 along Y (indices 10–17), enough to prove they're excluded by |Z.
  const xEdges: SubShapeDescriptor[] = [10, 11, 12, 13].map((index) => ({
    index, kind: 'edge', geomType: 'line', measure: 1, centroid: v(0.5, 0, 0), obb: [0, 0, 0.5], direction: v(1, 0, 0),
  }));
  const yEdges: SubShapeDescriptor[] = [14, 15, 16, 17].map((index) => ({
    index, kind: 'edge', geomType: 'line', measure: 1, centroid: v(0, 0.5, 0), obb: [0, 0, 0.5], direction: v(0, 1, 0),
  }));
  return [...faces, ...zEdges, ...xEdges, ...yEdges];
}

const faces = () => boxDescriptors().filter((d) => d.kind === 'face');
const edges = () => boxDescriptors().filter((d) => d.kind === 'edge');

describe('evaluate — directional selectors (box faces)', () => {
  it('>Z picks the top face; <Z the bottom', () => {
    expect(selectSubShapes(faces(), '>Z')).toEqual([0]);
    expect(selectSubShapes(faces(), '<Z')).toEqual([1]);
  });

  it('|Z picks both horizontal faces (normal ∥ Z)', () => {
    expect(selectSubShapes(faces(), '|Z').sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it('#Z picks the four vertical walls (normal ⊥ Z)', () => {
    expect(selectSubShapes(faces(), '#Z')).toEqual([2, 3, 4, 5]);
  });

  it('+Z / -Z pick the outward-facing top / bottom by normal direction', () => {
    expect(selectSubShapes(faces(), '+Z')).toEqual([0]);
    expect(selectSubShapes(faces(), '-Z')).toEqual([1]);
  });
});

describe('evaluate — the flagship "fillet all vertical edges" case', () => {
  it('|Z selects exactly the four Z-directed edges', () => {
    expect(selectSubShapes(edges(), '|Z')).toEqual([6, 7, 8, 9]);
  });
});

describe('evaluate — type, ties, nth', () => {
  it('%plane matches all six box faces', () => {
    expect(selectSubShapes(faces(), '%plane')).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('>Z groups a tie: two co-planar top faces both come back', () => {
    const tied = [
      { index: 0, kind: 'face', geomType: 'plane', measure: 1, centroid: v(0, 0, 2), obb: [0, 1, 1], direction: v(0, 0, 1) },
      { index: 1, kind: 'face', geomType: 'plane', measure: 1, centroid: v(5, 5, 2), obb: [0, 1, 1], direction: v(0, 0, 1) },
      { index: 2, kind: 'face', geomType: 'plane', measure: 1, centroid: v(0, 0, 0), obb: [0, 1, 1], direction: v(0, 0, -1) },
    ] as SubShapeDescriptor[];
    expect(selectSubShapes(tied, '>Z').sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it('>Z[1] selects the second-highest group', () => {
    const stacked = [0, 1, 2].map((i) => ({
      index: i, kind: 'face', geomType: 'plane', measure: 1,
      centroid: v(0, 0, i), obb: [0, 1, 1], direction: v(0, 0, 1),
    })) as SubShapeDescriptor[];
    expect(selectSubShapes(stacked, '>Z[0]')).toEqual([2]); // z=2 highest
    expect(selectSubShapes(stacked, '>Z[1]')).toEqual([1]); // next
  });
});

describe('evaluate — radius & near', () => {
  it('radius(0) picks the smallest-radius group', () => {
    const circles = [
      { index: 0, kind: 'edge', geomType: 'circle', measure: 6.28, centroid: v(0, 0, 0), obb: [0, 1, 1], radius: 1 },
      { index: 1, kind: 'edge', geomType: 'circle', measure: 12.5, centroid: v(0, 0, 5), obb: [0, 2, 2], radius: 2 },
    ] as SubShapeDescriptor[];
    expect(selectSubShapes(circles, 'radius(0)')).toEqual([0]);
    expect(selectSubShapes(circles, 'radius(1)')).toEqual([1]);
  });

  it('near(x,y,z) returns the single closest sub-shape', () => {
    expect(selectSubShapes(faces(), 'near(0.5, 0.5, 0.9)')).toEqual([0]); // closest to top
    expect(selectSubShapes(faces(), 'near(0.9, 0.5, 0.5)')).toEqual([2]); // closest to +X
  });
});

describe('evaluate — boolean composition', () => {
  it('AND intersects: horizontal faces that are also the top', () => {
    expect(selectSubShapes(faces(), '|Z >Z')).toEqual([0]);
  });

  it('OR unions and de-dupes', () => {
    expect(selectSubShapes(faces(), '>Z or <Z').sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it('NOT complements against the candidate set', () => {
    // everything that is NOT a horizontal face = the 4 walls
    expect(selectSubShapes(faces(), 'not |Z')).toEqual([2, 3, 4, 5]);
  });

  it('composes: top OR bottom, excluding the +X-adjacent — parenthesized', () => {
    const ast = parse('(>Z or <Z)');
    expect(evaluate(ast, faces()).sort((a, b) => a - b)).toEqual([0, 1]);
  });
});
