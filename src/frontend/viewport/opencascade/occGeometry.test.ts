import { describe, it, expect } from 'vitest';
import type { MeshData } from '@/cad/types';
import { buildFaceGeometry, buildFaceHighlightGeometry, groupEdgeSegmentsByEdge } from './occGeometry';

// 10×10 quad in the XY plane: 2 triangles on 2 CAD faces, 2 topological edges.
const faceVertices = new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0]);
const faceNormals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
const faceIndices = new Uint32Array([0, 1, 2, 0, 2, 3]);
const faceMapping = new Uint32Array([0, 1]);
const edgeVertices = new Float32Array([0, 0, 0, 10, 0, 0, 10, 0, 0, 10, 10, 0]);
const edgeMapping = new Uint32Array([5, 5]); // both segments belong to one topological edge

const mesh: MeshData = {
  faceVertices, faceNormals, faceIndices, faceMapping, edgeVertices, edgeMapping,
} as MeshData;

describe('buildFaceGeometry', () => {
  it('sets position, normal, and index attributes', () => {
    const geo = buildFaceGeometry(mesh);
    expect(geo.attributes.position.count).toBe(4);
    expect(geo.attributes.normal.count).toBe(4);
    expect(geo.index?.count).toBe(6);
  });
});

describe('buildFaceHighlightGeometry', () => {
  const faceGeometry = buildFaceGeometry(mesh);

  it('returns null for null/undefined face id', () => {
    expect(buildFaceHighlightGeometry(faceGeometry, faceMapping, null)).toBeNull();
    expect(buildFaceHighlightGeometry(faceGeometry, faceMapping, undefined)).toBeNull();
  });

  it('returns null when the face has no triangles', () => {
    expect(buildFaceHighlightGeometry(faceGeometry, faceMapping, 99)).toBeNull();
  });

  it('collects exactly the one triangle belonging to the given face', () => {
    const geo = buildFaceHighlightGeometry(faceGeometry, faceMapping, 1);
    expect(geo).not.toBeNull();
    // One triangle → 3 vertices, 3 indices.
    expect(geo!.attributes.position.count).toBe(3);
    expect(geo!.index?.count).toBe(3);
  });

  it('returns null when faceMapping is missing', () => {
    expect(buildFaceHighlightGeometry(faceGeometry, undefined, 0)).toBeNull();
  });
});

describe('groupEdgeSegmentsByEdge', () => {
  it('groups segments sharing an edgeMapping id into one entry', () => {
    const groups = groupEdgeSegmentsByEdge(mesh);
    expect(groups).toHaveLength(1);
    expect(groups[0].edgeId).toBe(5);
    // Two segments × 6 floats = 12.
    expect(groups[0].vertices).toHaveLength(12);
  });

  it('falls back to segment index when edgeMapping is absent', () => {
    const groups = groupEdgeSegmentsByEdge({ ...mesh, edgeMapping: undefined } as MeshData);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.edgeId)).toEqual([0, 1]);
  });
});
