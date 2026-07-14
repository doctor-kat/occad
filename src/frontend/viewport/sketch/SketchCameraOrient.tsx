import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { Sketch } from '@/cad/types';
import { computeSketchViewpoint } from './sketchViewpoint';

/**
 * On entering a sketch, swing the camera to look straight at the sketch plane
 * (CAD "normal to" view). Rendered inside the Canvas alongside OrbitControls.
 *
 * Reorients only once per sketch (keyed on sketch id) so incidental remounts or
 * rebuilds while editing don't yank a view the user has since orbited.
 */
export function SketchCameraOrient({ activeSketch }: { activeSketch?: Sketch | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | { target: { copy: (v: unknown) => void }; update: () => void }
    | null;
  const orientedSketchId = useRef<string | null>(null);

  useEffect(() => {
    const id = activeSketch?.id ?? null;

    // Reset when leaving sketch mode so re-entering the same sketch reorients again.
    if (!id || !activeSketch?.workplane) {
      orientedSketchId.current = null;
      return;
    }
    if (orientedSketchId.current === id) return;
    // OrbitControls registers itself as the default `controls` on mount; wait for it
    // so target/update stay in sync with the camera move.
    if (!controls) return;
    orientedSketchId.current = id;

    const { position, up, target } = computeSketchViewpoint(activeSketch.workplane, camera.position);
    camera.up.copy(up);
    camera.position.copy(position);
    camera.lookAt(target);
    controls.target.copy(target);
    controls.update();
  }, [activeSketch, camera, controls]);

  return null;
}
