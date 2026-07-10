import { useEffect, type RefObject } from "react";
import * as THREE from "three";

/**
 * While in sketch mode, disable raycasting on a viewport object so the model doesn't
 * intercept pointer events meant for the sketch overlay; restore the default raycast
 * when leaving sketch mode. `deps` lets callers re-run the toggle when the underlying
 * object is rebuilt (e.g. new mesh geometry swaps the ref's target).
 */
export function useDisableRaycastInSketchMode(
  ref: RefObject<THREE.Object3D>,
  inSketchMode: boolean,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const obj = ref.current;
    if (!obj) return;
    if (inSketchMode) {
      obj.raycast = () => { };
    } else {
      delete (obj as any).raycast;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSketchMode, ...deps]);
}
