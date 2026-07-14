import * as THREE from "three";

/**
 * SolidWorks-style mouse model: the camera lives on the MIDDLE button only.
 *
 * LEFT is freed for selection (model single-pick; sketch box/crossing select)
 * and RIGHT is freed for the future context menu. three's OrbitControls treats any button
 * whose value is not a `THREE.MOUSE` action as disabled (`STATE.NONE`), so the
 * `null` entries below switch LEFT/RIGHT off entirely.
 */
export const CAMERA_MOUSE_BUTTONS = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.ROTATE,
  RIGHT: null,
} as unknown as { LEFT: THREE.MOUSE; MIDDLE: THREE.MOUSE; RIGHT: THREE.MOUSE };

/**
 * The full SolidWorks middle-button model: plain MMB drag orbits, Ctrl+MMB pans,
 * Shift+MMB zooms (dolly). OrbitControls maps one action per button, so the swap
 * is applied imperatively on the live controls instance as the modifiers change.
 *
 * Ctrl wins if both modifiers are held (pan over zoom) — an arbitrary but stable
 * tiebreak; SolidWorks assigns each gesture a distinct single modifier.
 */
export function middleButtonAction(ctrlKey: boolean, shiftKey = false): THREE.MOUSE {
  if (ctrlKey) return THREE.MOUSE.PAN;
  if (shiftKey) return THREE.MOUSE.DOLLY;
  return THREE.MOUSE.ROTATE;
}
