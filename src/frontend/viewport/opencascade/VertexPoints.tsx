import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import type { MeshData } from "@/cad/types";
import { useDisableRaycastInSketchMode } from "./useDisableRaycastInSketchMode.ts";

export interface VertexPointsProps {
  mesh: MeshData;
  selectedVertexIndex?: number | null;
  inSketchMode: boolean;
  onVertexClick?: (vertexIndex: number) => void;
}

/** Mesh vertices as clickable/hoverable points. */
export function VertexPoints({ mesh, selectedVertexIndex, inSketchMode, onVertexClick }: VertexPointsProps) {
  const vertexRef = useRef<THREE.Points>(null);
  const [hoveredVertexIndex, setHoveredVertexIndex] = useState<number | null>(null);

  useDisableRaycastInSketchMode(vertexRef, inSketchMode);

  const vertexGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(mesh.faceVertices, 3));
    return geo;
  }, [mesh.faceVertices]);

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (event.index !== undefined) {
      event.stopPropagation();
      setHoveredVertexIndex(event.index);
    }
  };

  const handlePointerLeave = () => setHoveredVertexIndex(null);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.index !== undefined) {
      event.stopPropagation();
      onVertexClick?.(event.index);
    }
  };

  return (
    <points
      ref={vertexRef}
      geometry={vertexGeometry}
      onClick={inSketchMode ? undefined : handleClick}
      onPointerMove={inSketchMode ? undefined : handlePointerMove}
      onPointerLeave={inSketchMode ? undefined : handlePointerLeave}
    >
      <pointsMaterial
        size={
          selectedVertexIndex !== null && selectedVertexIndex !== undefined
            ? 8
            : hoveredVertexIndex !== null
              ? 6
              : 4
        }
        color={
          selectedVertexIndex !== null && selectedVertexIndex !== undefined
            ? "#3b82f6" // Blue when selected
            : hoveredVertexIndex !== null
              ? "#f97316" // Orange when hovered
              : "#444466" // Dark when normal
        }
        sizeAttenuation={false}
      />
    </points>
  );
}
