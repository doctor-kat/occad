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

/**
 * True if the raycaster hits a dimension handle anywhere along the ray —
 * not just the nearest hit. The sketch's own semi-transparent background
 * click-plane (`SketchOverlay`'s plane mesh, used for drawing/face clicks)
 * sits at a small z-offset from the workplane, and dimension handles sit at
 * a slightly different small z-offset on the *other* side of it depending on
 * the workplane's normal direction — so which one is "nearer the camera" is
 * not consistent across workplane orientations. These are all invisible
 * hit-test proxies stacked at nearly the same spot, not opaque geometry that
 * actually occludes one another, so "nearest wins" is the wrong model here:
 * any tagged hit along the ray means the gesture belongs to that handle.
 */
export function hitsDimensionHandle(raycaster: THREE.Raycaster, scene: THREE.Object3D): boolean {
  const hits = raycaster.intersectObjects(scene.children, true);
  return hits.some((hit) => !!hit.object.userData?.[DIMENSION_HANDLE_USERDATA_KEY]);
}
