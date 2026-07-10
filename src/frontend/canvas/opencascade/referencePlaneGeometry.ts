import * as THREE from "three";

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
 * transiently when it is selected or hovered, or whenever the app is awaiting a
 * sketch-plane pick (showAllPlanes) — so there is always something to click,
 * even on a brand-new document with no geometry yet.
 */
export function isPlaneVisible(
  planeId: string,
  opts: {
    selectedPlaneId: string | null;
    hoveredPlaneId?: string | null;
    visibilityMap: Record<string, boolean>;
    showAllPlanes?: boolean;
  }
): boolean {
  return (
    opts.showAllPlanes === true ||
    opts.visibilityMap[planeId] === true ||
    opts.selectedPlaneId === planeId ||
    opts.hoveredPlaneId === planeId
  );
}

const PLANE_SIZE = 100;

/**
 * Build the dashed "crosshair" that connects the midpoints of opposite edges:
 * a horizontal segment and a vertical segment that intersect at the plane origin.
 * The `lineDistance` attribute is precomputed (as LineSegments.computeLineDistances
 * would) so a dashed material renders correctly.
 */
export function createPlaneCrosshair(planeSize = PLANE_SIZE): THREE.BufferGeometry {
  const half = planeSize / 2;
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    // Horizontal: left-edge midpoint -> right-edge midpoint
    -half, 0, 0,
    half, 0, 0,
    // Vertical: bottom-edge midpoint -> top-edge midpoint
    0, -half, 0,
    0, half, 0,
  ]);
  // Per-vertex distance along each segment (resets at the start of each pair).
  const lineDistances = new Float32Array([0, planeSize, 0, planeSize]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("lineDistance", new THREE.BufferAttribute(lineDistances, 1));
  return geometry;
}

/**
 * Build the square outline shared by all three reference planes (all use `PLANE_SIZE`).
 */
export function createPlaneEdges(planeSize = PLANE_SIZE): THREE.BufferGeometry {
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
}

export { PLANE_SIZE };
