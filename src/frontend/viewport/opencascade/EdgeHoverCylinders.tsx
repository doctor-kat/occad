import { useMemo } from "react";
import * as THREE from "three";
import type { MeshData } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";

/** Cylinders align their local Y axis with the edge; the up vector is a constant. */
const UP = new THREE.Object3D().up;

export interface EdgeHoverCylindersProps {
  mesh: MeshData;
  selectedEdgeIndex?: number | null;
  onEdgeClick?: (edgeIndex: number) => void;
}

interface CylinderTransform {
  topologicalEdgeId: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
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

  // The geometry (position/quaternion/length) only depends on the edge data, so build
  // it once per mesh rather than per hover/selection change — only the material's
  // visible/color below reacts to hover state.
  const transforms = useMemo<CylinderTransform[]>(() => {
    const out: CylinderTransform[] = [];
    for (let i = 0; i < Math.floor(mesh.edgeVertices.length / 6); i++) {
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
      const length = new THREE.Vector3().subVectors(p2, p1).length();
      const position = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      // Calculate rotation to align cylinder with edge direction
      const orientation = new THREE.Matrix4();
      orientation.lookAt(p1, p2, UP);
      orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(orientation);

      out.push({ topologicalEdgeId: mesh.edgeMapping ? mesh.edgeMapping[i] : i, position, quaternion, length });
    }
    return out;
  }, [mesh.edgeVertices, mesh.edgeMapping]);

  const selectedEdgeIndexSet = new Set(selectedEdgeIndices);

  return (
    <>
      {transforms.map(({ topologicalEdgeId, position, quaternion, length }, i) => {
        const isSelected = selectedEdgeIndex === topologicalEdgeId || selectedEdgeIndexSet.has(topologicalEdgeId);
        const isHovered = hoveredEdgeIndex === topologicalEdgeId;

        return (
          <mesh
            key={i}
            position={position}
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
