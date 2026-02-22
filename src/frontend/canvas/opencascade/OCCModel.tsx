import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import type { MeshData } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";

export interface OCCModelProps {
  mesh: MeshData;
  selectedFaceId?: number | null;
  selectedEdgeIndex?: number | null;
  selectedVertexIndex?: number | null;
  inSketchMode?: boolean;
  onFaceClick?: (faceId: number) => void;
  onEdgeClick?: (edgeIndex: number) => void;
  onVertexClick?: (vertexIndex: number) => void;
}

export function OCCModel({ mesh, selectedFaceId, selectedEdgeIndex, selectedVertexIndex, inSketchMode = false, onFaceClick, onEdgeClick, onVertexClick }: OCCModelProps) {
  const hoveredFaceId = useViewportStore((state) => state.hoveredFaceId);
  const hoveredEdgeIndex = useViewportStore((state) => state.hoveredEdgeIndex);
  const setHoveredFaceId = useViewportStore((state) => state.setHoveredFaceId);
  const setHoveredEdgeIndex = useViewportStore((state) => state.setHoveredEdgeIndex);
  const faceRef = useRef<THREE.Mesh>(null);
  const highlightRef = useRef<THREE.Mesh>(null);
  const selectedHighlightRef = useRef<THREE.Mesh>(null);
  const vertexRef = useRef<THREE.Points>(null);
  const [hoveredCADFaceId, setHoveredCADFaceId] = useState<number | null>(null);
  const [internalHoveredEdgeIndex, setInternalHoveredEdgeIndex] = useState<number | null>(null);
  const [hoveredVertexIndex, setHoveredVertexIndex] = useState<number | null>(null);

  // Combine external hover (from menu) with internal hover (from pointer events)
  const effectiveHoveredFaceId = hoveredFaceId ?? hoveredCADFaceId;
  const effectiveHoveredEdgeIndex = hoveredEdgeIndex ?? internalHoveredEdgeIndex;

  // Disable raycasting on the model when in sketch mode
  useEffect(() => {
    const meshes = [faceRef.current, highlightRef.current, selectedHighlightRef.current, vertexRef.current];

    meshes.forEach(meshRef => {
      if (meshRef) {
        if (inSketchMode) {
          meshRef.raycast = () => { };
        } else {
          // Restore default raycast
          delete (meshRef as any).raycast;
        }
      }
    });
  }, [inSketchMode, mesh.edgeVertices]);

  const faceGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(mesh.faceVertices, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(mesh.faceNormals, 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.faceIndices, 1));
    return geo;
  }, [mesh.faceVertices, mesh.faceNormals, mesh.faceIndices]);

  // Create highlight geometry for all triangles belonging to the hovered CAD face
  const highlightGeometry = useMemo(() => {
    if (effectiveHoveredFaceId === null || !faceGeometry.index || !mesh.faceMapping) return null;

    const geo = new THREE.BufferGeometry();
    const positions = faceGeometry.attributes.position;
    const normals = faceGeometry.attributes.normal;
    const indices = faceGeometry.index;
    const faceMapping = mesh.faceMapping;

    // Find all triangles that belong to this CAD face
    const highlightVerts: number[] = [];
    const highlightNormals: number[] = [];
    const highlightIndices: number[] = [];
    let vertexCount = 0;

    for (let triIdx = 0; triIdx < faceMapping.length; triIdx++) {
      if (faceMapping[triIdx] === effectiveHoveredFaceId) {
        // This triangle belongs to the hovered face
        const i0 = indices.getX(triIdx * 3);
        const i1 = indices.getX(triIdx * 3 + 1);
        const i2 = indices.getX(triIdx * 3 + 2);

        // Add vertices
        highlightVerts.push(
          positions.getX(i0), positions.getY(i0), positions.getZ(i0),
          positions.getX(i1), positions.getY(i1), positions.getZ(i1),
          positions.getX(i2), positions.getY(i2), positions.getZ(i2)
        );

        // Add normals
        highlightNormals.push(
          normals.getX(i0), normals.getY(i0), normals.getZ(i0),
          normals.getX(i1), normals.getY(i1), normals.getZ(i1),
          normals.getX(i2), normals.getY(i2), normals.getZ(i2)
        );

        // Add indices
        highlightIndices.push(vertexCount, vertexCount + 1, vertexCount + 2);
        vertexCount += 3;
      }
    }

    if (highlightVerts.length === 0) return null;

    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(highlightVerts), 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(highlightNormals), 3));
    geo.setIndex(highlightIndices);

    return geo;
  }, [effectiveHoveredFaceId, faceGeometry, mesh.faceMapping]);

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!mesh.faceMapping) return;

    // Use the faceIndex from the event, which is specific to the mesh being hovered
    if (event.faceIndex !== undefined) {
      event.stopPropagation();
      const triangleIndex = event.faceIndex;
      const cadFaceId = mesh.faceMapping[triangleIndex];
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
      const triangleIndex = event.faceIndex;
      const cadFaceId = mesh.faceMapping[triangleIndex];
      onFaceClick?.(cadFaceId);
    }
  };

  // Create highlight geometry for selected face
  const selectedHighlightGeometry = useMemo(() => {
    if (selectedFaceId === null || selectedFaceId === undefined || !faceGeometry.index || !mesh.faceMapping) return null;

    const geo = new THREE.BufferGeometry();
    const positions = faceGeometry.attributes.position;
    const normals = faceGeometry.attributes.normal;
    const indices = faceGeometry.index;
    const faceMapping = mesh.faceMapping;

    // Find all triangles that belong to the selected face
    const highlightVerts: number[] = [];
    const highlightNormals: number[] = [];
    const highlightIndices: number[] = [];
    let vertexCount = 0;

    for (let triIdx = 0; triIdx < faceMapping.length; triIdx++) {
      if (faceMapping[triIdx] === selectedFaceId) {
        const i0 = indices.getX(triIdx * 3);
        const i1 = indices.getX(triIdx * 3 + 1);
        const i2 = indices.getX(triIdx * 3 + 2);

        highlightVerts.push(
          positions.getX(i0), positions.getY(i0), positions.getZ(i0),
          positions.getX(i1), positions.getY(i1), positions.getZ(i1),
          positions.getX(i2), positions.getY(i2), positions.getZ(i2)
        );

        highlightNormals.push(
          normals.getX(i0), normals.getY(i0), normals.getZ(i0),
          normals.getX(i1), normals.getY(i1), normals.getZ(i1),
          normals.getX(i2), normals.getY(i2), normals.getZ(i2)
        );

        highlightIndices.push(vertexCount, vertexCount + 1, vertexCount + 2);
        vertexCount += 3;
      }
    }

    if (highlightVerts.length === 0) return null;

    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(highlightVerts), 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(highlightNormals), 3));
    geo.setIndex(highlightIndices);

    return geo;
  }, [selectedFaceId, faceGeometry, mesh.faceMapping]);

  const handleVertexPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (event.index !== undefined) {
      event.stopPropagation();
      setHoveredVertexIndex(event.index);
    }
  };

  const handleVertexPointerLeave = () => {
    setHoveredVertexIndex(null);
  };

  const handleVertexClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.index !== undefined) {
      event.stopPropagation();
      onVertexClick?.(event.index);
    }
  };

  // Create vertices as clickable points
  const vertexGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(mesh.faceVertices, 3));
    return geo;
  }, [mesh.faceVertices]);

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
        <mesh ref={selectedHighlightRef} geometry={selectedHighlightGeometry}>
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
        <mesh ref={highlightRef} geometry={highlightGeometry}>
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

      {/* Edge wireframe - group segments by topological edge for unified highlighting */}
      {useMemo(() => {
        // Group segments by their topological edge ID
        const edgeGroups = new Map<number, number[]>();
        const segmentCount = Math.floor(mesh.edgeVertices.length / 6);

        for (let i = 0; i < segmentCount; i++) {
          const edgeId = mesh.edgeMapping ? mesh.edgeMapping[i] : i;
          if (!edgeGroups.has(edgeId)) {
            edgeGroups.set(edgeId, []);
          }
          edgeGroups.get(edgeId)!.push(i);
        }

        // Render each topological edge as a single lineSegments
        return Array.from(edgeGroups.entries()).map(([edgeId, segments]) => {
          const isSelected = selectedEdgeIndex === edgeId;
          const isHovered = effectiveHoveredEdgeIndex === edgeId;

          // Collect all vertices for this topological edge
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

          const edgeGeometry = new THREE.BufferGeometry();
          edgeGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));

          return (
            <lineSegments key={edgeId} geometry={edgeGeometry}>
              <lineBasicMaterial
                color={
                  isSelected
                    ? "#3b82f6" // Blue when selected
                    : isHovered
                      ? "#f97316" // Orange when hovered
                      : "#222233" // Darker gray/navy for better contrast
                }
                linewidth={isSelected ? 3 : isHovered ? 2 : 1}
                transparent
                opacity={isSelected ? 1 : isHovered ? 0.9 : 0.8}
              />
            </lineSegments>
          );
        });
      }, [mesh.edgeVertices, mesh.edgeMapping, selectedEdgeIndex, effectiveHoveredEdgeIndex])}

      {/* Cylinders for edge hover detection and hover highlight */}
      {!inSketchMode && Array.from({ length: Math.floor(mesh.edgeVertices.length / 6) }).map((_, i) => {
        const topologicalEdgeId = mesh.edgeMapping ? mesh.edgeMapping[i] : i;
        const isSelected = selectedEdgeIndex === topologicalEdgeId;
        const isHovered = effectiveHoveredEdgeIndex === topologicalEdgeId;

        const p1 = new THREE.Vector3(
          mesh.edgeVertices[i * 6],
          mesh.edgeVertices[i * 6 + 1],
          mesh.edgeVertices[i * 6 + 2]
        );
        const p2 = new THREE.Vector3(
          mesh.edgeVertices[i * 6 + 3],
          mesh.edgeVertices[i * 6 + 4],
          mesh.edgeVertices[i * 6 + 5]
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
              setInternalHoveredEdgeIndex(topologicalEdgeId);
              setHoveredEdgeIndex(topologicalEdgeId);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setInternalHoveredEdgeIndex(null);
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
              8
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

      {/* Vertices as clickable points */}
      <points
        ref={vertexRef}
        geometry={vertexGeometry}
        onClick={inSketchMode ? undefined : handleVertexClick}
        onPointerMove={inSketchMode ? undefined : handleVertexPointerMove}
        onPointerLeave={inSketchMode ? undefined : handleVertexPointerLeave}
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
    </group>
  );
}
