import * as THREE from 'three';

/**
 * userData key set on the invisible dimension-label and arrowhead hit-target
 * meshes in `SketchRenderer`'s `DimensionAnnotation`. `SketchOverlay`'s
 * box-select gesture is a raw `addEventListener('pointerdown', ...)` on the
 * canvas, entirely separate from r3f's own synthetic event dispatch — so it
 * can't tell "this pointerdown is over a dimension handle, let that mesh's
 * own handler own the gesture" from "empty space, start a rubber-band" via
 * event ordering (a prior fix tried a store flag set from the mesh's
 * onPointerDown, but that relies on which of the two listeners on the same
 * canvas element fires first, which depends on component mount order —
 * React fires child effects before parent effects, so the deeply-nested
 * `SketchOverlay` listener actually attaches, and fires, before r3f's own
 * top-level dispatcher, making the flag never be set in time). Raycasting
 * directly against tagged objects sidesteps listener ordering entirely.
 */
export const DIMENSION_HANDLE_USERDATA_KEY = 'isDimensionHandle';

/** True if the nearest object the raycaster hits is tagged as a dimension handle. */
export function hitsDimensionHandle(raycaster: THREE.Raycaster, scene: THREE.Object3D): boolean {
  const hits = raycaster.intersectObjects(scene.children, true);
  return hits.length > 0 && !!hits[0].object.userData?.[DIMENSION_HANDLE_USERDATA_KEY];
}
