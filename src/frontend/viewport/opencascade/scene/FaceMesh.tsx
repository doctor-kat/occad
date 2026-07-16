import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import type { MeshData } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import { buildFaceHighlightGeometry } from "../geometry/occGeometry.ts";
import { useDisableRaycastInSketchMode } from "../geometry/useDisableRaycastInSketchMode.ts";

export interface FaceMeshProps {
  mesh: MeshData;
  faceGeometry: THREE.BufferGeometry;
  selectedFaceId?: number | null;
  inSketchMode: boolean;
  onFaceClick?: (faceId: number) => void;
}

/** Solid body faces + hovered/selected face highlight overlays and face pointer handling. */
export function FaceMesh({ mesh, faceGeometry, selectedFaceId, inSketchMode, onFaceClick }: FaceMeshProps) {
  const hoveredFaceId = useViewportStore((state) => state.hoveredFaceId);
  const setHoveredFaceId = useViewportStore((state) => state.setHoveredFaceId);
  const faceRef = useRef<THREE.Mesh>(null);
  const [hoveredCADFaceId, setHoveredCADFaceId] = useState<number | null>(null);

  // Combine external hover (from menu) with internal hover (from pointer events).
  const effectiveHoveredFaceId = hoveredFaceId ?? hoveredCADFaceId;

  useDisableRaycastInSketchMode(faceRef, inSketchMode);

  const highlightGeometry = useMemo(
    () => buildFaceHighlightGeometry(faceGeometry, mesh.faceMapping, effectiveHoveredFaceId),
    [effectiveHoveredFaceId, faceGeometry, mesh.faceMapping],
  );

  const selectedHighlightGeometry = useMemo(
    () => buildFaceHighlightGeometry(faceGeometry, mesh.faceMapping, selectedFaceId),
    [selectedFaceId, faceGeometry, mesh.faceMapping],
  );

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!mesh.faceMapping) return;
    if (event.faceIndex !== undefined) {
      event.stopPropagation();
      const cadFaceId = mesh.faceMapping[event.faceIndex];
      setHoveredCADFaceId(cadFaceId);
      setHoveredFaceId(cadFaceId);
    }
  };

  const handlePointerLeave = () => {
    setHoveredCADFaceId(null);
    setHoveredFaceId(null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!mesh.faceMapping) return;
    if (event.faceIndex !== undefined) {
      event.stopPropagation();
      onFaceClick?.(mesh.faceMapping[event.faceIndex]);
    }
  };

  return (
    <group>
      {/* Solid faces */}
      <mesh
        ref={faceRef}
        geometry={faceGeometry}
        onPointerMove={inSketchMode ? undefined : handlePointerMove}
        onPointerLeave={inSketchMode ? undefined : handlePointerLeave}
        onClick={inSketchMode ? undefined : handleClick}
      >
        <meshPhysicalMaterial
          color={inSketchMode ? "#5a7090" : "#7c93c3"}
          metalness={0.15}
          roughness={0.35}
          clearcoat={0.4}
          clearcoatRoughness={0.25}
          envMapIntensity={0.8}
          transparent={inSketchMode}
          opacity={inSketchMode ? 0.3 : 1}
          side={THREE.DoubleSide}
          depthWrite={!inSketchMode}
          polygonOffset={true}
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* Selected face highlight (blue) */}
      {selectedHighlightGeometry && (
        <mesh geometry={selectedHighlightGeometry}>
          <meshBasicMaterial
            color="#3b82f6"
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthTest={true}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Hovered face highlight (subtle) - only show if not the selected face */}
      {highlightGeometry && effectiveHoveredFaceId !== selectedFaceId && (
        <mesh geometry={highlightGeometry}>
          <meshBasicMaterial
            color="orange"
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthTest={true}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
