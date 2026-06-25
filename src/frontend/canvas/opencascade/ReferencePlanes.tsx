import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { Text as Text3D } from "@react-three/drei";

export interface ReferencePlanesProps {
  selectedPlaneId: string | null;
  hoveredPlaneId?: string | null;
  visibilityMap: Record<string, boolean>;
  onPlaneClick?: (planeId: string) => void;
}

/**
 * Build an id -> visible map from a project's reference geometry. A plane/origin
 * is visible only when its `isVisible` flag is explicitly true.
 */
export function buildReferenceVisibilityMap(
  referenceGeometry?: ReadonlyArray<{ id: string; isVisible: boolean }>
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  referenceGeometry?.forEach((ref) => {
    map[ref.id] = ref.isVisible === true;
  });
  return map;
}

/**
 * A reference plane is shown when its visibility is toggled on (from the tree),
 * or transiently when it is selected or hovered.
 */
export function isPlaneVisible(
  planeId: string,
  opts: {
    selectedPlaneId: string | null;
    hoveredPlaneId?: string | null;
    visibilityMap: Record<string, boolean>;
  }
): boolean {
  return (
    opts.visibilityMap[planeId] === true ||
    opts.selectedPlaneId === planeId ||
    opts.hoveredPlaneId === planeId
  );
}

export function ReferencePlanes({ selectedPlaneId, hoveredPlaneId, visibilityMap, onPlaneClick }: ReferencePlanesProps) {
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

  // Check if plane should be visible: toggled on, or selected/hovered from tree
  const planeVisible = (planeId: string) =>
    isPlaneVisible(planeId, { selectedPlaneId, hoveredPlaneId, visibilityMap });

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
      {planeVisible('front-plane') && (
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
      {planeVisible('top-plane') && (
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
      {planeVisible('right-plane') && (
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
