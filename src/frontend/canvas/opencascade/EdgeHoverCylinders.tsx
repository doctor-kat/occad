import * as THREE from "three";
import type { MeshData } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";

export interface EdgeHoverCylindersProps {
  mesh: MeshData;
  selectedEdgeIndex?: number | null;
  onEdgeClick?: (edgeIndex: number) => void;
}

/**
 * Invisible fat cylinders along each wireframe segment, used as reliable hover/click
 * targets for edges (raw line raycasting is too thin to hit). Only rendered outside
 * sketch mode. Kept mapping-aware inline (segment index → edgeMapping) rather than
 * reusing computeEdgeSegments, which drops degenerate segments and would misalign IDs.
 */
export function EdgeHoverCylinders({ mesh, selectedEdgeIndex, onEdgeClick }: EdgeHoverCylindersProps) {
  const hoveredEdgeIndex = useViewportStore((state) => state.hoveredEdgeIndex);
  const selectedEdgeIndices = useViewportStore((state) => state.selectedEdgeIndices);
  const setHoveredEdgeIndex = useViewportStore((state) => state.setHoveredEdgeIndex);

  const selectedEdgeIndexSet = new Set(selectedEdgeIndices);

  return (
    <>
      {Array.from({ length: Math.floor(mesh.edgeVertices.length / 6) }).map((_, i) => {
        const topologicalEdgeId = mesh.edgeMapping ? mesh.edgeMapping[i] : i;
        const isSelected = selectedEdgeIndex === topologicalEdgeId || selectedEdgeIndexSet.has(topologicalEdgeId);
        const isHovered = hoveredEdgeIndex === topologicalEdgeId;

        const p1 = new THREE.Vector3(
          mesh.edgeVertices[i * 6],
          mesh.edgeVertices[i * 6 + 1],
          mesh.edgeVertices[i * 6 + 2],
        );
        const p2 = new THREE.Vector3(
          mesh.edgeVertices[i * 6 + 3],
          mesh.edgeVertices[i * 6 + 4],
          mesh.edgeVertices[i * 6 + 5],
        );
        const direction = new THREE.Vector3().subVectors(p2, p1);
        const length = direction.length();
        const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        // Calculate rotation to align cylinder with edge direction
        const orientation = new THREE.Matrix4();
        orientation.lookAt(p1, p2, new THREE.Object3D().up);
        orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        const quaternion = new THREE.Quaternion().setFromRotationMatrix(orientation);

        return (
          <mesh
            key={i}
            position={center}
            quaternion={quaternion}
            renderOrder={1}
            onClick={(e) => {
              e.stopPropagation();
              onEdgeClick?.(topologicalEdgeId);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredEdgeIndex(topologicalEdgeId);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoveredEdgeIndex(null);
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
            }}
          >
            <cylinderGeometry args={[
              0.5, // Consistent hit radius
              0.5,
              length,
              8,
            ]} />
            <meshBasicMaterial
              visible={isSelected || isHovered}
              color={isSelected ? "#3b82f6" : "#f97316"}
              transparent
              opacity={isSelected ? 0.8 : 0.6}
              depthTest={true}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </>
  );
}
