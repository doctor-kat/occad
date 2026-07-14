import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SketchElement, SketchOperation } from '@/cad/types';
import { boxMode, rectFromCorners, selectElementsInBox } from '@/cad/engine/sketch/sketchBoxSelection';
import { hitsDimensionHandle } from '@/cad/engine/sketch/dimensionHandleHitTest';

/**
 * Left-button rubber-band box / crossing selection of sketch entities — active
 * only in selection mode (no draw tool). The camera is on the middle button, so
 * the left button is free here. Listeners live on the canvas element (not the
 * R3F plane mesh) so the gesture works in raw screen px and doesn't depend on the
 * plane's move-only raycasting. Drag right → window (fully enclosed); drag left →
 * crossing (touching). See sketchBoxSelection.ts for the hit math.
 *
 * Returns `suppressClickRef` — set true the moment a box drag passes the
 * movement threshold, so the plane's onClick (which still fires on pointer-up
 * after a drag) can skip its single-pick toggle. The caller resets it after
 * checking.
 */
export function useSketchBoxSelection(
  elements: SketchElement[],
  activeOperation: SketchOperation | null,
  selectedSketchElementIds: string[],
  planeTransform: THREE.Matrix4,
  setSketchSelectionBox: (box: { x: number; y: number; w: number; h: number; mode: 'window' | 'crossing' } | null) => void,
  setSketchElementSelection: (ids: string[]) => void
) {
  const { camera, gl, size, scene } = useThree();

  // Mutable mirrors read by the gl.domElement listeners (registered once). Reading
  // these from refs keeps the listener effect from re-binding on every elements/
  // camera/size change mid-drag.
  const cameraRef = useRef(camera);
  const sizeRef = useRef(size);
  const sceneRef = useRef(scene);
  const elementsRef = useRef(elements);
  const planeTransformRef = useRef<THREE.Matrix4 | null>(null);
  if (planeTransformRef.current === null) planeTransformRef.current = new THREE.Matrix4();
  const activeOperationRef = useRef(activeOperation);
  const selectedRef = useRef(selectedSketchElementIds);
  const suppressClickRef = useRef(false);

  // Keep the listener-facing mirrors current (cheap, runs every render).
  cameraRef.current = camera;
  sizeRef.current = size;
  sceneRef.current = scene;
  elementsRef.current = elements;
  planeTransformRef.current = planeTransform;
  activeOperationRef.current = activeOperation;
  selectedRef.current = selectedSketchElementIds;

  useEffect(() => {
    const dom = gl.domElement;
    const DRAG_THRESHOLD = 4; // px before a press counts as a drag, not a click

    let startX = 0, startY = 0; // canvas-local px at press
    let curX = 0, curY = 0;
    let pressed = false;
    let dragging = false;
    let additive = false; // Ctrl/Shift held → merge/toggle into the current set

    const toLocal = (e: PointerEvent) => {
      const r = dom.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // Plane point → screen px, via the live camera (matches the rubber-band space).
    const project = (p: { x: number; y: number }) => {
      const v = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(planeTransformRef.current!);
      v.project(cameraRef.current as THREE.Camera);
      const { width, height } = sizeRef.current;
      return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
    };

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;            // left button only
      if (activeOperationRef.current) return; // a draw tool owns the left button
      // A dimension label/arrowhead drag owns this gesture instead of box-select.
      // Raycast directly against tagged handle meshes rather than relying on a
      // flag set by another listener — two listeners on the same canvas element
      // (this raw one, and r3f's own dispatcher) fire in registration order, which
      // depends on component mount order (child effects run before parent ones),
      // not on which gesture logically "owns" the pointerdown.
      const p = toLocal(e);
      ndc.set((p.x / sizeRef.current.width) * 2 - 1, -(p.y / sizeRef.current.height) * 2 + 1);
      raycaster.setFromCamera(ndc, cameraRef.current as THREE.Camera);
      if (hitsDimensionHandle(raycaster, sceneRef.current)) return;
      pressed = true;
      dragging = false;
      additive = e.ctrlKey || e.metaKey || e.shiftKey;
      startX = curX = p.x;
      startY = curY = p.y;
    };

    const onMove = (e: PointerEvent) => {
      if (!pressed) return;
      const p = toLocal(e);
      curX = p.x;
      curY = p.y;
      if (!dragging && Math.hypot(curX - startX, curY - startY) > DRAG_THRESHOLD) {
        dragging = true;
        suppressClickRef.current = true; // swallow the trailing plane onClick
      }
      if (dragging) {
        setSketchSelectionBox({
          x: Math.min(startX, curX),
          y: Math.min(startY, curY),
          w: Math.abs(curX - startX),
          h: Math.abs(curY - startY),
          mode: boxMode(startX, curX),
        });
      }
    };

    const onUp = () => {
      if (!pressed) return;
      pressed = false;
      if (!dragging) return;
      dragging = false;
      const mode = boxMode(startX, curX);
      const rect = rectFromCorners(startX, startY, curX, curY);
      const hits = selectElementsInBox(elementsRef.current, rect, mode, project);
      if (additive) {
        const set = new Set(selectedRef.current);
        for (const id of hits) {
          if (set.has(id)) set.delete(id); else set.add(id);
        }
        setSketchElementSelection(Array.from(set));
      } else {
        setSketchElementSelection(hits);
      }
      setSketchSelectionBox(null);
    };

    const onCancel = () => {
      pressed = false;
      dragging = false;
      setSketchSelectionBox(null);
    };

    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [gl, setSketchSelectionBox, setSketchElementSelection]);

  return suppressClickRef;
}
