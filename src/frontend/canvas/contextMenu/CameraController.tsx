import { useEffect, useRef, type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type { MeshData } from '@/cad/types';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { boundsFromVertices, computeCameraView } from './cameraViews';

export interface CameraControllerProps {
  /** Current body mesh — its vertices define the bounds to frame. */
  mesh: MeshData | null;
  /** Live OrbitControls instance (for its `target` + `update()`). */
  controlsRef: MutableRefObject<any>;
}

/**
 * Applies one-shot camera framing requests from the store (Zoom to Fit + the
 * standard orientations picked in the empty-space context menu). Lives inside
 * the R3F Canvas so it can read the live camera; the menu itself is a DOM
 * overlay that just sets `cameraCommand` on the store.
 *
 * Frames the current body's bounding sphere; if there is no mesh, falls back to
 * a fixed radius so the standard views still reorient a document that only has
 * reference planes.
 */
export function CameraController({ mesh, controlsRef }: CameraControllerProps) {
  const camera = useThree((s) => s.camera);
  const command = useViewportStore((s) => s.cameraCommand);
  const lastNonce = useRef<number | null>(null);

  useEffect(() => {
    if (!command || command.nonce === lastNonce.current) return;
    lastNonce.current = command.nonce;

    const bounds =
      (mesh && boundsFromVertices(mesh.faceVertices)) ||
      { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 50 }, center: { x: 0, y: 0, z: 0 }, radius: 50 };

    const controls = controlsRef.current;
    const target = controls?.target ?? { x: 0, y: 0, z: 0 };
    const currentDir = {
      x: camera.position.x - target.x,
      y: camera.position.y - target.y,
      z: camera.position.z - target.z,
    };

    const fov = (camera as any).isPerspectiveCamera ? (camera as any).fov : 45;
    const { position, target: newTarget } = computeCameraView(command.view, bounds, currentDir, fov);

    camera.position.set(position.x, position.y, position.z);
    if (controls) {
      controls.target.set(newTarget.x, newTarget.y, newTarget.z);
      controls.update();
    } else {
      camera.lookAt(newTarget.x, newTarget.y, newTarget.z);
    }
    camera.updateProjectionMatrix();
  }, [command, mesh, camera, controlsRef]);

  return null;
}
