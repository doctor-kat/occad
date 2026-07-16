import { useEffect, type RefObject } from "react";
import * as THREE from "three";

/**
 * While in sketch mode, disable raycasting on a viewport object so the model doesn't
 * intercept pointer events meant for the sketch overlay; restore the default raycast
 * when leaving sketch mode. R3F keeps the same object instance across geometry-prop
 * swaps, so the override survives re-renders and only needs to re-run on `inSketchMode`.
 */
export function useDisableRaycastInSketchMode(ref: RefObject<THREE.Object3D>, inSketchMode: boolean) {
  useEffect(() => {
    const obj = ref.current;
    if (!obj) return;
    if (inSketchMode) {
      obj.raycast = () => { };
    } else {
      delete (obj as any).raycast;
    }
  }, [inSketchMode]);
}
