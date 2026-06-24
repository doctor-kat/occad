import * as THREE from "three";

// ---------------------------------------------------------------------------
// Edge segment hit-area geometry
//
// Raw line raycasting is unreliable (the hit threshold is razor thin), so —
// mirroring OCCModel's edge hover detection — we place an invisible cylinder
// along every wireframe segment to act as a fat, reliable hover/click target.
// ---------------------------------------------------------------------------
export interface EdgeSegment {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
}

/** Build one oriented cylinder transform per line segment in `edgeVertices`. */
export function computeEdgeSegments(edgeVertices: Float32Array): EdgeSegment[] {
  const segments: EdgeSegment[] = [];
  const count = Math.floor(edgeVertices.length / 6);

  for (let i = 0; i < count; i++) {
    const p1 = new THREE.Vector3(
      edgeVertices[i * 6],
      edgeVertices[i * 6 + 1],
      edgeVertices[i * 6 + 2]
    );
    const p2 = new THREE.Vector3(
      edgeVertices[i * 6 + 3],
      edgeVertices[i * 6 + 4],
      edgeVertices[i * 6 + 5]
    );

    const length = new THREE.Vector3().subVectors(p2, p1).length();
    if (length === 0) continue; // degenerate segment — nothing to hover

    const position = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    // Align the cylinder's local Y axis with the edge direction.
    const orientation = new THREE.Matrix4();
    orientation.lookAt(p1, p2, new THREE.Object3D().up);
    orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(orientation);

    segments.push({ position, quaternion, length });
  }

  return segments;
}
