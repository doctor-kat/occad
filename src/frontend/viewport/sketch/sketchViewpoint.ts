import * as THREE from 'three';
import type { Workplane } from '@/cad/types';

export interface SketchViewpoint {
  /** Where to place the camera. */
  position: THREE.Vector3;
  /** Camera up vector (sketch +Y points up on screen). */
  up: THREE.Vector3;
  /** Where the camera looks / OrbitControls target. */
  target: THREE.Vector3;
}

/**
 * Compute a camera viewpoint that looks straight down a sketch plane's normal
 * (the standard CAD "normal to" view), framed on the plane origin.
 *
 * Only the viewing *angle* is changed — the distance to the plane is preserved
 * from the current camera so we don't fight a zoom level the user has chosen. We
 * also keep the camera on whichever side of the plane it's already on, so entering
 * a sketch never flips the view to the back of the plane.
 */
export function computeSketchViewpoint(
  workplane: Workplane,
  currentCameraPos: THREE.Vector3,
  fallbackDistance = 1500
): SketchViewpoint {
  const target = new THREE.Vector3(workplane.origin.x, workplane.origin.y, workplane.origin.z);
  const up = new THREE.Vector3(workplane.yAxis.x, workplane.yAxis.y, workplane.yAxis.z).normalize();
  let normal = new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z).normalize();

  // Preserve the current zoom: distance from the existing camera to the plane.
  const currentDist = currentCameraPos.distanceTo(target);
  const distance = currentDist > 1 ? currentDist : fallbackDistance;

  // Stay on the side the camera is already on (don't flip to the back face).
  const toCamera = new THREE.Vector3().subVectors(currentCameraPos, target);
  if (normal.dot(toCamera) < 0) normal = normal.negate();

  const position = target.clone().addScaledVector(normal, distance);
  return { position, up, target };
}
