import * as THREE from "three";
import type { MeshData } from "@/cad/types";

/** Build the solid-body BufferGeometry (positions, normals, indices) from mesh data. */
export function buildFaceGeometry(mesh: MeshData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(mesh.faceVertices, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(mesh.faceNormals, 3));
  geo.setIndex(new THREE.BufferAttribute(mesh.faceIndices, 1));
  return geo;
}

/**
 * Build a highlight BufferGeometry containing every triangle that belongs to a single
 * CAD face (`faceId`). Used for both the hovered- and selected-face overlays, which
 * previously duplicated this triangle-collection loop. Returns null when the face has
 * no triangles or the required data is missing.
 */
export function buildFaceHighlightGeometry(
  faceGeometry: THREE.BufferGeometry,
  faceMapping: MeshData["faceMapping"] | undefined,
  faceId: number | null | undefined,
): THREE.BufferGeometry | null {
  if (faceId === null || faceId === undefined || !faceGeometry.index || !faceMapping) return null;

  const positions = faceGeometry.attributes.position;
  const normals = faceGeometry.attributes.normal;
  const indices = faceGeometry.index;

  const highlightVerts: number[] = [];
  const highlightNormals: number[] = [];
  const highlightIndices: number[] = [];
  let vertexCount = 0;

  for (let triIdx = 0; triIdx < faceMapping.length; triIdx++) {
    if (faceMapping[triIdx] === faceId) {
      const i0 = indices.getX(triIdx * 3);
      const i1 = indices.getX(triIdx * 3 + 1);
      const i2 = indices.getX(triIdx * 3 + 2);

      highlightVerts.push(
        positions.getX(i0), positions.getY(i0), positions.getZ(i0),
        positions.getX(i1), positions.getY(i1), positions.getZ(i1),
        positions.getX(i2), positions.getY(i2), positions.getZ(i2),
      );

      highlightNormals.push(
        normals.getX(i0), normals.getY(i0), normals.getZ(i0),
        normals.getX(i1), normals.getY(i1), normals.getZ(i1),
        normals.getX(i2), normals.getY(i2), normals.getZ(i2),
      );

      highlightIndices.push(vertexCount, vertexCount + 1, vertexCount + 2);
      vertexCount += 3;
    }
  }

  if (highlightVerts.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(highlightVerts), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(highlightNormals), 3));
  geo.setIndex(highlightIndices);
  return geo;
}

export interface EdgeGroup {
  edgeId: number;
  /** Flat [x1,y1,z1,x2,y2,z2, ...] positions for every segment in this topological edge. */
  vertices: Float32Array;
}

/**
 * Group raw wireframe segments by their topological edge ID (from `edgeMapping`, or the
 * segment index itself when unmapped) so each CAD edge renders as one unified lineSegments.
 */
export function groupEdgeSegmentsByEdge(mesh: MeshData): EdgeGroup[] {
  const edgeGroups = new Map<number, number[]>();
  const segmentCount = Math.floor(mesh.edgeVertices.length / 6);

  for (let i = 0; i < segmentCount; i++) {
    const edgeId = mesh.edgeMapping ? mesh.edgeMapping[i] : i;
    if (!edgeGroups.has(edgeId)) edgeGroups.set(edgeId, []);
    edgeGroups.get(edgeId)!.push(i);
  }

  return Array.from(edgeGroups.entries()).map(([edgeId, segments]) => {
    const vertices: number[] = [];
    for (const segIdx of segments) {
      vertices.push(
        mesh.edgeVertices[segIdx * 6],
        mesh.edgeVertices[segIdx * 6 + 1],
        mesh.edgeVertices[segIdx * 6 + 2],
        mesh.edgeVertices[segIdx * 6 + 3],
        mesh.edgeVertices[segIdx * 6 + 4],
        mesh.edgeVertices[segIdx * 6 + 5],
      );
    }
    return { edgeId, vertices: new Float32Array(vertices) };
  });
}
