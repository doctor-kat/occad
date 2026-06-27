import * as THREE from "three";

/**
 * SolidWorks-style mouse model: the camera lives on the MIDDLE button only.
 *
 * LEFT is freed for selection (single-pick / future box-select) and RIGHT is
 * freed for the future context menu. three's OrbitControls treats any button
 * whose value is not a `THREE.MOUSE` action as disabled (`STATE.NONE`), so the
 * `null` entries below switch LEFT/RIGHT off entirely.
 */
export const CAMERA_MOUSE_BUTTONS = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: null,
} as unknown as { LEFT: THREE.MOUSE; MIDDLE: THREE.MOUSE; RIGHT: THREE.MOUSE };

/**
 * While the camera is on the middle button, Ctrl swaps it from orbit to pan
 * (SolidWorks: MMB = rotate, Ctrl+MMB = pan). OrbitControls maps one action per
 * button, so the swap is applied imperatively on the live controls instance.
 */
export function middleButtonAction(ctrlKey: boolean): THREE.MOUSE {
  return ctrlKey ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
}
