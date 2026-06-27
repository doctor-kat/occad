import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CAMERA_MOUSE_BUTTONS, middleButtonAction } from "./cameraMouseButtons";

describe("CAMERA_MOUSE_BUTTONS", () => {
  it("puts orbit on the middle button", () => {
    expect(CAMERA_MOUSE_BUTTONS.MIDDLE).toBe(THREE.MOUSE.ROTATE);
  });

  it("disables the left button (freed for selection)", () => {
    // null is not a THREE.MOUSE action, so OrbitControls treats LEFT as STATE.NONE
    expect(CAMERA_MOUSE_BUTTONS.LEFT).toBeNull();
    expect(CAMERA_MOUSE_BUTTONS.LEFT).not.toBe(THREE.MOUSE.ROTATE);
    expect(CAMERA_MOUSE_BUTTONS.LEFT).not.toBe(THREE.MOUSE.PAN);
  });

  it("disables the right button (freed for the context menu)", () => {
    expect(CAMERA_MOUSE_BUTTONS.RIGHT).toBeNull();
    expect(CAMERA_MOUSE_BUTTONS.RIGHT).not.toBe(THREE.MOUSE.PAN);
  });
});

describe("middleButtonAction", () => {
  it("orbits on a plain middle drag", () => {
    expect(middleButtonAction(false)).toBe(THREE.MOUSE.ROTATE);
  });

  it("pans when Ctrl is held (SolidWorks Ctrl+MMB)", () => {
    expect(middleButtonAction(true)).toBe(THREE.MOUSE.PAN);
  });
});
