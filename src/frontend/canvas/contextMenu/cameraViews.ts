/**
 * Pure camera-framing math for the empty-space context menu ("Zoom to Fit" and
 * the standard orientations). Kept free of Three.js/R3F so it is unit testable;
 * the CameraController component (inside the Canvas) applies the results to the
 * live camera + OrbitControls.
 */

import type { CameraViewType } from '@/frontend/shared/viewportStore';

export type { CameraViewType };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  /** Radius of the bounding sphere around `center`. */
  radius: number;
}

/**
 * Bounding box + sphere of a flat [x,y,z, x,y,z, …] vertex buffer. Returns null
 * for an empty buffer (nothing to frame). Used to size a fit/standard view.
 */
export function boundsFromVertices(vertices: ArrayLike<number>): Bounds | null {
  if (!vertices || vertices.length < 3) return null;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const center: Vec3 = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  const dx = maxX - center.x, dy = maxY - center.y, dz = maxZ - center.z;
  const radius = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-3);
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ }, center, radius };
}

/** Unit view directions (camera→target) for each standard orientation. */
const VIEW_DIRECTIONS: Record<Exclude<CameraViewType, 'fit'>, Vec3> = {
  front: { x: 0, y: 0, z: 1 },
  back: { x: 0, y: 0, z: -1 },
  top: { x: 0, y: 1, z: 0 },
  bottom: { x: 0, y: -1, z: 0 },
  right: { x: 1, y: 0, z: 0 },
  left: { x: -1, y: 0, z: 0 },
  iso: { x: 1, y: 0.8, z: 1 },
};

const norm = (v: Vec3): Vec3 => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};

/**
 * Camera position + target that frames `bounds` for the given view. For 'fit'
 * the current view direction (camera − target, normalized) is preserved so the
 * user keeps their orientation; the other views snap to a fixed axis. The
 * distance places the bounding sphere just inside the given vertical FOV, scaled
 * by `margin` for a little breathing room.
 */
export function computeCameraView(
  view: CameraViewType,
  bounds: Bounds,
  currentDir: Vec3,
  fovDegrees = 45,
  margin = 1.25,
): { position: Vec3; target: Vec3 } {
  const dir = view === 'fit' ? norm(currentDir) : norm(VIEW_DIRECTIONS[view]);
  const halfFov = (fovDegrees * Math.PI) / 180 / 2;
  const distance = (bounds.radius / Math.sin(halfFov)) * margin;
  const position: Vec3 = {
    x: bounds.center.x + dir.x * distance,
    y: bounds.center.y + dir.y * distance,
    z: bounds.center.z + dir.z * distance,
  };
  return { position, target: bounds.center };
}
