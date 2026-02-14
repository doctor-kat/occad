import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport, Environment, Grid, Text as Text3D } from "@react-three/drei";
import * as THREE from "three";
import type { MeshData } from "@/hooks/useOpenCascade";
import type { OCCStatus } from "@/hooks/useOpenCascade";
import { CircleNotch, Check, X, Circle, Minus, NavigationArrow, Dot } from "@phosphor-icons/react";
import type { CADProject, Sketch, SketchTool, SketchEdgeData } from "@/types/cad";
import { SketchOverlay } from "./SketchOverlay";
import { Button, Box, Stack, Text, Group, Center, Paper, useMantineTheme } from "@mantine/core";
import { useViewportStore } from "@/stores/viewportStore";

// ---------------------------------------------------------------------------
// Mesh component — converts raw OCC tessellation buffers into Three geometry
// ---------------------------------------------------------------------------
interface OCCModelProps {
  mesh: MeshData;
  selectedFaceId?: number | null;
  selectedEdgeIndex?: number | null;
  selectedVertexIndex?: number | null;
  inSketchMode?: boolean;
  onFaceClick?: (faceId: number) => void;
  onEdgeClick?: (edgeIndex: number) => void;
  onVertexClick?: (vertexIndex: number) => void;
}

function OCCModel({ mesh, selectedFaceId, selectedEdgeIndex, selectedVertexIndex, inSketchMode = false, onFaceClick, onEdgeClick, onVertexClick }: OCCModelProps) {
  const hoveredFaceId = useViewportStore((state) => state.hoveredFaceId);
  const hoveredEdgeIndex = useViewportStore((state) => state.hoveredEdgeIndex);
  const setHoveredFaceId = useViewportStore((state) => state.setHoveredFaceId);
  const setHoveredEdgeIndex = useViewportStore((state) => state.setHoveredEdgeIndex);
  const faceRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.LineSegments>(null);
  const highlightRef = useRef<THREE.Mesh>(null);
  const selectedHighlightRef = useRef<THREE.Mesh>(null);
  const vertexRef = useRef<THREE.Points>(null);
  const [hoveredCADFaceId, setHoveredCADFaceId] = useState<number | null>(null);
  const [internalHoveredEdgeIndex, setInternalHoveredEdgeIndex] = useState<number | null>(null);
  const [hoveredVertexIndex, setHoveredVertexIndex] = useState<number | null>(null);
  const { raycaster, camera } = useThree();

  // Combine external hover (from menu) with internal hover (from pointer events)
  const effectiveHoveredFaceId = hoveredFaceId ?? hoveredCADFaceId;
  const effectiveHoveredEdgeIndex = hoveredEdgeIndex ?? internalHoveredEdgeIndex;

  // Disable raycasting on the model when in sketch mode
  // Also set raycasting threshold for edges and vertices
  useEffect(() => {
    const meshes = [faceRef.current, edgeRef.current, highlightRef.current, selectedHighlightRef.current, vertexRef.current];

    meshes.forEach(meshRef => {
      if (meshRef) {
        if (inSketchMode) {
          meshRef.raycast = () => {};
        } else {
          // Restore default raycast
          delete (meshRef as any).raycast;
        }
      }
    });

    // Set raycasting threshold for edges (makes them easier to hover)
    if (edgeRef.current && !inSketchMode) {
      // Increase the threshold for line raycasting to make edges easier to select
      (edgeRef.current as any).computeLineDistances?.();
    }

    // Set raycasting threshold for vertices (makes them easier to hover)
    if (vertexRef.current && !inSketchMode) {
      // Points already have reasonable raycasting
    }
  }, [inSketchMode, mesh.edgeVertices]);

  const faceGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(mesh.faceVertices, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(mesh.faceNormals, 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.faceIndices, 1));
    return geo;
  }, [mesh.faceVertices, mesh.faceNormals, mesh.faceIndices]);

  const edgeGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(mesh.edgeVertices, 3));
    return geo;
  }, [mesh.edgeVertices]);

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

  const handlePointerMove = (event: any) => {
    if (!faceRef.current || !mesh.faceMapping) return;

    // Get the intersection
    const intersects = event.intersections;
    if (intersects.length > 0 && intersects[0].faceIndex !== undefined) {
      const triangleIndex = intersects[0].faceIndex;
      const cadFaceId = mesh.faceMapping[triangleIndex];
      setHoveredCADFaceId(cadFaceId);
      setHoveredFaceId(cadFaceId);
    } else {
      setHoveredCADFaceId(null);
      setHoveredFaceId(null);
    }
  };

  const handlePointerLeave = () => {
    setHoveredCADFaceId(null);
    setHoveredFaceId(null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!mesh.faceMapping) return;

    event.stopPropagation();

    if (event.faceIndex !== undefined) {
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

  const handleEdgePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (event.index !== undefined) {
      const edgeIndex = Math.floor(event.index / 2); // Each edge has 2 vertices
      setInternalHoveredEdgeIndex(edgeIndex);
      setHoveredEdgeIndex(edgeIndex);
    } else {
      // Fallback: try to detect which edge segment was hit
      const point = event.point;
      if (point && edgeRef.current) {
        // Find closest edge to the hit point
        const positions = mesh.edgeVertices;
        let closestEdge = -1;
        let minDist = Infinity;

        for (let i = 0; i < positions.length / 6; i++) {
          const p1 = new THREE.Vector3(positions[i * 6], positions[i * 6 + 1], positions[i * 6 + 2]);
          const p2 = new THREE.Vector3(positions[i * 6 + 3], positions[i * 6 + 4], positions[i * 6 + 5]);
          const line = new THREE.Line3(p1, p2);
          const closestPoint = new THREE.Vector3();
          line.closestPointToPoint(point, true, closestPoint);
          const dist = point.distanceTo(closestPoint);

          if (dist < minDist && dist < 2) { // Within 2 units
            minDist = dist;
            closestEdge = i;
          }
        }

        if (closestEdge >= 0) {
          setInternalHoveredEdgeIndex(closestEdge);
          setHoveredEdgeIndex(closestEdge);
        }
      }
    }
  };

  const handleEdgePointerLeave = () => {
    setInternalHoveredEdgeIndex(null);
    setHoveredEdgeIndex(null);
  };

  const handleEdgeClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // For edges, we'll use the point index as the edge identifier
    if (event.index !== undefined) {
      const edgeIndex = Math.floor(event.index / 2); // Each edge has 2 vertices
      onEdgeClick?.(edgeIndex);
    }
  };

  const handleVertexPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (event.index !== undefined) {
      setHoveredVertexIndex(event.index);
    }
  };

  const handleVertexPointerLeave = () => {
    setHoveredVertexIndex(null);
  };

  const handleVertexClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.index !== undefined) {
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

      {/* Edge wireframe - render each edge separately for independent coloring */}
      {Array.from({ length: Math.floor(mesh.edgeVertices.length / 6) }).map((_, i) => {
        const isSelected = selectedEdgeIndex === i;
        const isHovered = effectiveHoveredEdgeIndex === i;

        const segmentGeometry = useMemo(() => {
          const geo = new THREE.BufferGeometry();
          const vertices = new Float32Array([
            mesh.edgeVertices[i * 6],
            mesh.edgeVertices[i * 6 + 1],
            mesh.edgeVertices[i * 6 + 2],
            mesh.edgeVertices[i * 6 + 3],
            mesh.edgeVertices[i * 6 + 4],
            mesh.edgeVertices[i * 6 + 5],
          ]);
          geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
          return geo;
        }, [i]);

        return (
          <lineSegments key={i} geometry={segmentGeometry}>
            <lineBasicMaterial
              color={
                isSelected
                  ? "#3b82f6" // Blue when selected
                  : isHovered
                    ? "#f97316" // Orange when hovered
                    : "#1a1a2e" // Dark when normal
              }
              linewidth={isSelected ? 3 : isHovered ? 2 : 1}
              transparent
              opacity={isSelected ? 1 : isHovered ? 0.85 : 0.55}
            />
          </lineSegments>
        );
      })}

      {/* Cylinders for edge hover detection and hover highlight */}
      {!inSketchMode && Array.from({ length: Math.floor(mesh.edgeVertices.length / 6) }).map((_, i) => {
        const isSelected = selectedEdgeIndex === i;
        const isHovered = effectiveHoveredEdgeIndex === i;

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
              onEdgeClick?.(i);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setInternalHoveredEdgeIndex(i);
              onEdgeHover?.(i);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setInternalHoveredEdgeIndex(null);
              onEdgeHover?.(null);
            }}
          >
            <cylinderGeometry args={[
              isSelected ? 0.25 : isHovered ? 0.2 : 1.0,
              isSelected ? 0.25 : isHovered ? 0.2 : 1.0,
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

// ---------------------------------------------------------------------------
// Reference Planes — visual representation of Front, Top, and Right planes
// ---------------------------------------------------------------------------
interface ReferencePlanesProps {
  selectedPlaneId: string | null;
  hoveredPlaneId?: string | null;
  visibilityMap: Record<string, boolean>;
  onPlaneClick?: (planeId: string) => void;
}

function ReferencePlanes({ selectedPlaneId, hoveredPlaneId, visibilityMap, onPlaneClick }: ReferencePlanesProps) {
  const planeSize = 100;

  const handlePlaneClick = (e: ThreeEvent<MouseEvent>, planeId: string) => {
    e.stopPropagation();
    onPlaneClick?.(planeId);
  };

  // Get color for plane outline
  const getPlaneColor = (planeId: string) => {
    if (selectedPlaneId === planeId) return "#3b82f6"; // Blue when selected
    if (hoveredPlaneId === planeId) return "#f97316"; // Orange when hovered
    return "#888888"; // Gray default
  };

  // Check if plane should be visible: only if selected or hovered from tree
  const isPlaneVisible = (planeId: string) => {
    return selectedPlaneId === planeId || hoveredPlaneId === planeId;
  };

  // Create plane outline edges
  const createPlaneEdges = () => {
    const halfSize = planeSize / 2;
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Four corners making a square outline
      -halfSize, -halfSize, 0,
      halfSize, -halfSize, 0,

      halfSize, -halfSize, 0,
      halfSize, halfSize, 0,

      halfSize, halfSize, 0,
      -halfSize, halfSize, 0,

      -halfSize, halfSize, 0,
      -halfSize, -halfSize, 0,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return geometry;
  };

  return (
    <group>
      {/* Front Plane (XY plane at Z=0) - Outline only */}
      {isPlaneVisible('front-plane') && (
        <group>
          {/* Plane outline */}
          <lineSegments geometry={createPlaneEdges()} position={[0, 0, 0]}>
            <lineBasicMaterial
              color={getPlaneColor('front-plane')}
              linewidth={2}
              toneMapped={false}
            />
          </lineSegments>
          {/* Invisible clickable plane for selection */}
          <mesh
            position={[0, 0, 0]}
            onClick={(e) => handlePlaneClick(e, 'front-plane')}
          >
            <planeGeometry args={[planeSize, planeSize]} />
            <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
          </mesh>
          <Text3D
            position={[-45, 45, 0.1]}
            fontSize={3}
            color={getPlaneColor('front-plane')}
            anchorX="left"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#000000"
          >
            Front Plane
          </Text3D>
        </group>
      )}

      {/* Top Plane (XZ plane at Y=0) - Outline only */}
      {isPlaneVisible('top-plane') && (
        <group>
          {/* Plane outline */}
          <lineSegments
            geometry={createPlaneEdges()}
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <lineBasicMaterial
              color={getPlaneColor('top-plane')}
              linewidth={2}
              toneMapped={false}
            />
          </lineSegments>
          {/* Invisible clickable plane for selection */}
          <mesh
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => handlePlaneClick(e, 'top-plane')}
          >
            <planeGeometry args={[planeSize, planeSize]} />
            <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
          </mesh>
          <Text3D
            position={[-45, 0.1, -45]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={3}
            color={getPlaneColor('top-plane')}
            anchorX="left"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#000000"
          >
            Top Plane
          </Text3D>
        </group>
      )}

      {/* Right Plane (YZ plane at X=0) - Outline only */}
      {isPlaneVisible('right-plane') && (
        <group>
          {/* Plane outline */}
          <lineSegments
            geometry={createPlaneEdges()}
            position={[0, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <lineBasicMaterial
              color={getPlaneColor('right-plane')}
              linewidth={2}
              toneMapped={false}
            />
          </lineSegments>
          {/* Invisible clickable plane for selection */}
          <mesh
            position={[0, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            onClick={(e) => handlePlaneClick(e, 'right-plane')}
          >
            <planeGeometry args={[planeSize, planeSize]} />
            <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
          </mesh>
          <Text3D
            position={[0.1, 45, 45]}
            rotation={[0, Math.PI / 2, 0]}
            fontSize={3}
            color={getPlaneColor('right-plane')}
            anchorX="left"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#000000"
          >
            Right Plane
          </Text3D>
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Origin Point — visual representation of the origin
// ---------------------------------------------------------------------------
interface OriginPointProps {
  visible: boolean;
  selectedPlaneId: string | null;
  dimmed?: boolean;
}

function OriginPoint({ visible, selectedPlaneId, dimmed = false }: OriginPointProps) {
  if (!visible) return null;

  const isSelected = selectedPlaneId === 'origin';
  const size = isSelected ? 0.8 : 0.5;
  const axisLength = 15;

  const sphereOpacity = dimmed ? 0.2 : isSelected ? 1 : 0.8;
  const axisOpacity = dimmed ? 0.15 : 0.6;

  return (
    <group>
      {/* Origin sphere */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? "#ffffff" : "#888888"}
          transparent
          opacity={sphereOpacity}
        />
      </mesh>

      {/* X axis - Red */}
      <mesh position={[axisLength / 2, 0, 0]}>
        <boxGeometry args={[axisLength, 0.2, 0.2]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={axisOpacity} />
      </mesh>

      {/* Y axis - Green */}
      <mesh position={[0, axisLength / 2, 0]}>
        <boxGeometry args={[0.2, axisLength, 0.2]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={axisOpacity} />
      </mesh>

      {/* Z axis - Blue */}
      <mesh position={[0, 0, axisLength / 2]}>
        <boxGeometry args={[0.2, 0.2, axisLength]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={axisOpacity} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sketch wireframe — renders a single sketch's edge data as purple lines
// ---------------------------------------------------------------------------
function SketchWireframe({ edgeVertices }: { edgeVertices: Float32Array }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#a64dff" linewidth={2} />
    </lineSegments>
  );
}

// ---------------------------------------------------------------------------
// Sketch wireframes — renders visible sketch edges from rebuild data
// ---------------------------------------------------------------------------
interface SketchWireframesProps {
  project: CADProject;
  sketchEdges: Record<string, SketchEdgeData>;
}

function SketchWireframes({ project, sketchEdges }: SketchWireframesProps) {
  return (
    <>
      {project.sketches
        .filter((s) => s.isVisible && sketchEdges[s.id])
        .map((s) => (
          <SketchWireframe key={s.id} edgeVertices={sketchEdges[s.id].edgeVertices} />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Background mesh for catching clicks
// ---------------------------------------------------------------------------
function BackgroundPlane({ onClick }: { onClick: () => void }) {
  return (
    <mesh
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <planeGeometry args={[10000, 10000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Scene — lights, grid, controls, gizmo
// ---------------------------------------------------------------------------
interface SceneProps {
  mesh: MeshData | null;
  project?: CADProject;
  sketchEdges?: Record<string, SketchEdgeData> | null;
  selectedPlaneId: string | null;
  selectedFaceId?: number | null;
  selectedEdgeIndex?: number | null;
  selectedVertexIndex?: number | null;
  activeSketch?: Sketch | null;
  activeTool?: SketchTool | null;
  activeConstraint?: string;
  onPlaneClick?: (planeId: string) => void;
  onFaceClick?: (faceId: number) => void;
  onEdgeClick?: (edgeIndex: number) => void;
  onVertexClick?: (vertexIndex: number) => void;
  onBackgroundClick?: () => void;
  onUpdateSketch?: (sketchId: string, elements: any[]) => void;
}

function Scene({
  mesh,
  project,
  sketchEdges,
  selectedPlaneId,
  selectedFaceId,
  selectedEdgeIndex,
  selectedVertexIndex,
  activeSketch,
  activeTool,
  activeConstraint,
  onPlaneClick,
  onFaceClick,
  onEdgeClick,
  onVertexClick,
  onBackgroundClick,
  onUpdateSketch
}: SceneProps) {
  const hoveredTreeItem = useViewportStore((state) => state.hoveredTreeItem);
  const hoveredPlaneId = hoveredTreeItem;
  const inSketchMode = !!activeSketch;

  // Build visibility map from project reference geometry
  const visibilityMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    project?.referenceGeometry.forEach((ref) => {
      map[ref.id] = (ref as any).visible !== false; // Default to visible if not set
    });
    return map;
  }, [project?.referenceGeometry]);

  // Show origin based on visibility
  const showOrigin = visibilityMap['origin'] !== false;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[80, 120, 80]} intensity={1.2} castShadow />
      <directionalLight position={[-60, 80, -40]} intensity={0.6} />
      <Environment preset="studio" />

      {/* Background click catcher (invisible plane at low z-index) */}
      {onBackgroundClick && !inSketchMode && <BackgroundPlane onClick={onBackgroundClick} />}

      {/* Reference Planes - hidden in sketch mode */}
      {!inSketchMode && (
        <ReferencePlanes
          selectedPlaneId={selectedPlaneId}
          hoveredPlaneId={hoveredPlaneId}
          visibilityMap={visibilityMap}
          onPlaneClick={onPlaneClick}
        />
      )}

      {/* Origin Point - dimmed in sketch mode */}
      <OriginPoint visible={showOrigin} selectedPlaneId={selectedPlaneId} dimmed={inSketchMode} />

      {/* Model (only render if mesh data exists and at least one feature is visible) */}
      {mesh && (!project || project.features.some((f) => f.isVisible)) && (
        <OCCModel
          mesh={mesh}
          selectedFaceId={selectedFaceId}
          selectedEdgeIndex={selectedEdgeIndex}
          selectedVertexIndex={selectedVertexIndex}
          inSketchMode={inSketchMode}
          onFaceClick={onFaceClick}
          onEdgeClick={onEdgeClick}
          onVertexClick={onVertexClick}
        />
      )}

      {/* Sketch wireframes (visible sketches, not in sketch mode) */}
      {!inSketchMode && project && sketchEdges && (
        <SketchWireframes project={project} sketchEdges={sketchEdges} />
      )}

      {/* Sketch overlay (when in sketch mode) */}
      {activeSketch && onUpdateSketch && (
        <SketchOverlay
          sketch={activeSketch}
          activeTool={activeTool}
          activeConstraint={activeConstraint}
          onElementsChange={onUpdateSketch}
          onBackgroundClick={onBackgroundClick}
        />
      )}


      {/* Camera controls */}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />

      {/* View gizmo (top-right) */}
      <GizmoHelper alignment="top-right" margin={[72, 72]}>
        <GizmoViewport
          axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
          labelColor="white"
        />
      </GizmoHelper>
    </>
  );
}

// ---------------------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------------------
function LoadingOverlay({ message }: { message: string }) {
  return (
    <Box
      pos="absolute"
      style={{
        inset: 0,
        zIndex: 20,
        backgroundColor: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <Center h="100%">
        <Stack align="center" gap="xs">
          <CircleNotch size={32} weight="regular" color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          <Text size="sm" fw={500} c="dimmed">{message || "Loading\u2026"}</Text>
        </Stack>
      </Center>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Error overlay
// ---------------------------------------------------------------------------
function ErrorOverlay({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Box
      pos="absolute"
      style={{
        inset: 0,
        zIndex: 20,
        backgroundColor: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <Center h="100%">
        <Paper
          radius="md"
          p="xl"
          maw={384}
          style={{
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(24, 24, 27, 0.8)',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <Text size="sm" fw={600} c="red" mb={8}>
            OpenCascade Error
          </Text>
          <Text size="xs" c="dimmed" mb={16} style={{ wordBreak: 'break-word' }}>
            {error}
          </Text>
          <Button color="indigo" size="xs" onClick={onRetry}>
            Retry
          </Button>
        </Paper>
      </Center>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Selection Display — shows current selection at bottom-left
// ---------------------------------------------------------------------------
interface SelectionDisplayProps {
  selectedTreeItem?: string | null;
  project?: CADProject;
}

function SelectionDisplay({ selectedTreeItem, project }: SelectionDisplayProps) {
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);
  let displayText = "Nothing selected";

  if (selectedTreeItem && project) {
    // Check if it's a plane
    const plane = project.referenceGeometry.find((ref) => ref.id === selectedTreeItem);
    if (plane) {
      displayText = plane.name;
    } else {
      // Check if it's a sketch
      const sketch = project.sketches.find((s) => s.id === selectedTreeItem);
      if (sketch) {
        displayText = sketch.name;
      } else {
        // Check if it's a feature
        const feature = project.features.find((f) => f.id === selectedTreeItem);
        if (feature) {
          displayText = feature.name;
        }
      }
    }
  } else if (selectedFaceId !== null && selectedFaceId !== undefined) {
    displayText = `Face ${selectedFaceId + 1}`;
  } else if (selectedEdgeIndex !== null && selectedEdgeIndex !== undefined) {
    displayText = `Edge ${selectedEdgeIndex + 1}`;
  } else if (selectedVertexIndex !== null && selectedVertexIndex !== undefined) {
    displayText = `Vertex ${selectedVertexIndex + 1}`;
  }

  return (
    <Paper
      pos="absolute"
      radius="md"
      px={16}
      py={8}
      style={{
        bottom: 16,
        left: 16,
        zIndex: 10,
        backgroundColor: 'rgba(24, 24, 27, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: 13,
        fontWeight: 500,
        color: '#e5e5e5',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
      }}
    >
      <Text component="span" c="dimmed" mr={8}>Selected:</Text>
      {displayText}
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Main viewport
// ---------------------------------------------------------------------------
interface OpenCascadeViewportProps {
  /** CAD project to render (if provided, enables parametric mode) */
  project?: CADProject;
  /** Currently selected tree item ID */
  selectedTreeItem?: string | null;
  /** OpenCascade worker status */
  occStatus: OCCStatus;
  /** OpenCascade progress message */
  occProgress: string;
  /** OpenCascade error message */
  occError: string | null;
  /** Current mesh data from OpenCascade */
  occMesh: MeshData | null;
  /** Per-sketch edge data for wireframe rendering */
  occSketchEdges?: Record<string, SketchEdgeData> | null;
  /** Retry callback for OpenCascade errors */
  occRetry: () => void;
  /** Active sketch being edited (if in sketch mode) */
  activeSketch?: any | null;
  /** Active sketch tool */
  activeTool?: any | null;
  /** Callback when a plane is clicked */
  onPlaneClick?: (planeId: string) => void;
  /** Callback when a face is clicked */
  onFaceClick?: (faceId: number) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (edgeIndex: number) => void;
  /** Callback when a vertex is clicked */
  onVertexClick?: (vertexIndex: number) => void;
  /** Callback when background is clicked (clear selection) */
  onBackgroundClick?: () => void;
  /** Callback when sketch is updated */
  onUpdateSketch?: (sketchId: string, elements: any[]) => void;
  /** Callback when sketch editing is finished */
  onFinishSketch?: () => void;
  /** Callback when sketch editing is cancelled */
  onCancelSketch?: () => void;
}

export function OpenCascadeViewport({
  project,
  selectedTreeItem,
  occStatus,
  occProgress,
  occError,
  occMesh,
  occSketchEdges,
  occRetry,
  activeSketch,
  activeTool,
  onPlaneClick,
  onFaceClick,
  onEdgeClick,
  onVertexClick,
  onBackgroundClick,
  onUpdateSketch,
  onFinishSketch,
  onCancelSketch
}: OpenCascadeViewportProps) {
  // Get viewport interaction state from store
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);
  // Sketch constraints state
  type ConstraintType = 'none' | 'point' | 'edge' | 'midpoint' | 'center';
  const [activeConstraint, setActiveConstraint] = useState<ConstraintType>('none');

  const isLoading = occStatus === "loading" || occStatus === "building";

  // Show empty state if no mesh and not loading/errored
  const showEmpty = !occMesh && !isLoading && !occError;

  const theme = useMantineTheme();

  return (
    <Box
      pos="relative"
      h="100%"
      w="100%"
      style={{
        overflow: 'hidden',
        backgroundColor: '#0a0a0f',
      }}
    >
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [100, 80, 100], fov: 45, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "transparent", width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          {/* Always render the scene with planes, optionally with mesh */}
          <Scene
            mesh={occMesh}
            project={project}
            sketchEdges={occSketchEdges}
            selectedPlaneId={selectedTreeItem || null}
            selectedFaceId={selectedFaceId}
            selectedEdgeIndex={selectedEdgeIndex}
            selectedVertexIndex={selectedVertexIndex}
            activeSketch={activeSketch as Sketch | undefined}
            activeTool={activeTool as SketchTool | undefined}
            activeConstraint={activeConstraint}
            onPlaneClick={onPlaneClick}
            onFaceClick={onFaceClick}
            onEdgeClick={onEdgeClick}
            onVertexClick={onVertexClick}
            onBackgroundClick={onBackgroundClick}
            onUpdateSketch={onUpdateSketch}
          />
        </Suspense>
      </Canvas>

      {/* Sketch Controls Overlay (when in sketch mode) */}
      {activeSketch && (
        <Stack
          gap="sm"
          pos="absolute"
          style={{
            top: 16,
            right: 16,
            zIndex: 10,
          }}
        >
          <Box
            style={{
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.other.colors.border}`,
              backgroundColor: `${theme.other.colors.card}cc`,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              backdropFilter: 'blur(12px)',
              boxShadow: theme.shadows.lg,
            }}
          >
            <Text size="xs" fw={500} c={theme.other.colors.mutedForeground} mb="xs">
              Sketch Mode - Editing on {typeof activeSketch.plane === 'string' ? activeSketch.plane : 'Custom'} Plane
            </Text>
            <Group gap="sm">
              <Button
                size="xs"
                variant="outline"
                onClick={onCancelSketch}
                leftSection={<X size={14} weight="regular" />}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                onClick={onFinishSketch}
                leftSection={<Check size={14} weight="regular" />}
              >
                Finish Sketch
              </Button>
            </Group>
          </Box>

          {/* Element count */}
          <Box
            style={{
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.other.colors.border}`,
              backgroundColor: `${theme.other.colors.card}99`,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 6,
              backdropFilter: 'blur(12px)',
              boxShadow: theme.shadows.lg,
            }}
          >
            <Text size="xs" fw={500} c={theme.other.colors.mutedForeground}>
              Elements: {activeSketch.elements.length}
            </Text>
          </Box>
        </Stack>
      )}

      {/* Constraints Menu (when in sketch mode) */}
      {activeSketch && (
        <Box
          pos="absolute"
          style={{
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.other.colors.border}`,
            backgroundColor: `${theme.other.colors.card}cc`,
            backdropFilter: 'blur(12px)',
            boxShadow: theme.shadows.lg,
          }}
        >
          <Group gap={0} style={{ padding: 4 }}>
            <Text size="xs" fw={600} c={theme.other.colors.mutedForeground} px="sm" py="xs">
              Constraints:
            </Text>

            {([
              { key: 'none', label: 'None', icon: null },
              { key: 'point', label: 'Point', icon: <Dot size={16} weight="regular" /> },
              { key: 'edge', label: 'Edge', icon: <Minus size={16} weight="regular" /> },
              { key: 'midpoint', label: 'Midpoint', icon: <NavigationArrow size={16} weight="regular" /> },
              { key: 'center', label: 'Center', icon: <Circle size={16} weight="regular" /> },
            ] as const).map(({ key, label, icon }) => {
              const isActive = activeConstraint === key;
              return (
                <Button
                  key={key}
                  size="xs"
                  variant={isActive ? 'filled' : 'subtle'}
                  onClick={() => setActiveConstraint(key)}
                  leftSection={icon}
                  px="sm"
                  style={{
                    borderRadius: theme.radius.md,
                  }}
                  styles={{
                    root: {
                      ...(isActive && { '--button-bg': theme.colors.blue[5] }),
                    },
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </Group>
        </Box>
      )}

      {/* Selection Display */}
      <SelectionDisplay
        selectedTreeItem={selectedTreeItem}
        project={project}
      />

      {/* Overlays */}
      {isLoading && <LoadingOverlay message={occProgress} />}
      {occStatus === "error" && occError && <ErrorOverlay error={occError} onRetry={occRetry} />}

      {/* Empty state */}
      {showEmpty && (
        <Box pos="absolute" style={{ inset: 0, zIndex: 10 }}>
          <Center h="100%">
            <Stack align="center" gap={4}>
              <Text size="sm" fw={500} c="dimmed">
                No geometry to display
              </Text>
              <Text size="xs" c="dimmed">
                Create a sketch to get started
              </Text>
            </Stack>
          </Center>
        </Box>
      )}

      {/* Subtle gradient overlay */}
      <Box
        pos="absolute"
        style={{
          pointerEvents: 'none',
          inset: 0,
          background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.02), transparent, rgba(168, 85, 247, 0.02))',
        }}
      />
    </Box>
  );
}
