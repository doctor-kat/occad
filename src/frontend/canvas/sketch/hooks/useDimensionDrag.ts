import { useCallback, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sketch, Point2D } from '@/cad/types';
import { project } from '@/cad/engine/sketch/coordinateSystem';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { DEFAULT_LABEL_DISTANCE } from '../dimensionGeometryUtils';

const DRAG_THRESHOLD = 4;

interface UseDimensionDragArgs {
  workplane: Sketch['workplane'];
  visualMetadata: Sketch['visualMetadata'];
  onUpdateLabelOffset?: (constraintId: string, offset: Point2D) => void;
  onToggleArrowFlip?: (constraintId: string) => void;
}

/**
 * Drag/select behavior for dimension labels: a plain click selects/deselects, a drag
 * past DRAG_THRESHOLD repositions the label (live via `dragOffsets`, committed on
 * release via `onUpdateLabelOffset`). Also exposes the per-constraint highlight/offset/
 * arrow-flip helpers the annotations need.
 */
export function useDimensionDrag({ workplane, visualMetadata, onUpdateLabelOffset, onToggleArrowFlip }: UseDimensionDragArgs) {
  const { camera, gl } = useThree();
  const setSelectedConstraintId = useViewportStore((s) => s.setSelectedConstraintId);
  const selectedConstraintId = useViewportStore((s) => s.selectedConstraintId);

  // Live drag override, keyed by constraint id — follows the cursor at render rate
  // without touching parent state/solver until the drag is released.
  const [dragOffsets, setDragOffsets] = useState<Record<string, Point2D>>({});
  // Which dimension has crossed DRAG_THRESHOLD and is actively being repositioned —
  // set as soon as the drag "moved" flag flips, independent of whether the
  // screen-to-sketch-plane raycast that computes the actual offset succeeds, so the
  // highlight doesn't depend on that raycast (unlike `dragOffsets`, which does).
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // `moved` distinguishes a plain click (select/deselect) from an actual drag
  // (reposition the label) — mirrors the DRAG_THRESHOLD pattern used for the
  // sketch entity box-select gesture in SketchOverlay.
  const dragRef = useRef<{ constraintId: string; mid2d: Point2D; startX: number; startY: number; moved: boolean } | null>(null);

  // Highlight with the selection color both when formally selected AND while a drag is
  // actively in progress — the user shouldn't have to release the pointer first to see
  // which dimension they're moving.
  const isHighlighted = (constraintId: string) => selectedConstraintId === constraintId || activeDragId === constraintId;

  const worldPlane = useMemo(
    () => new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z),
      new THREE.Vector3(workplane.origin.x, workplane.origin.y, workplane.origin.z),
    ),
    [workplane],
  );

  const screenToLocal2D = useCallback((clientX: number, clientY: number): Point2D | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(worldPlane, hit)) return null;
    return project({ x: hit.x, y: hit.y, z: hit.z }, workplane);
  }, [camera, gl, worldPlane, workplane]);

  const onWindowMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD) {
      drag.moved = true;
      setActiveDragId(drag.constraintId);
    }
    if (!drag.moved) return; // still just a click until the pointer actually moves
    const local = screenToLocal2D(e.clientX, e.clientY);
    if (!local) return;
    setDragOffsets((prev) => ({ ...prev, [drag.constraintId]: { x: local.x - drag.mid2d.x, y: local.y - drag.mid2d.y } }));
  }, [screenToLocal2D]);

  const onWindowUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    setActiveDragId(null);
    if (!drag) return;
    if (!drag.moved) {
      // A plain click (no drag): select/deselect this dimension, same store field
      // constraint badges use, so SketchConstraintList highlighting stays in sync.
      const current = useViewportStore.getState().selectedConstraintId;
      setSelectedConstraintId(current === drag.constraintId ? null : drag.constraintId);
      return;
    }
    setDragOffsets((prev) => {
      const offset = prev[drag.constraintId];
      if (offset) onUpdateLabelOffset?.(drag.constraintId, offset);
      const next = { ...prev };
      delete next[drag.constraintId];
      return next;
    });
  }, [onWindowMove, onUpdateLabelOffset, setSelectedConstraintId]);

  const startDrag = useCallback((constraintId: string, mid2d: Point2D) => (e: any) => {
    e.stopPropagation();
    dragRef.current = { constraintId, mid2d, startX: e.clientX, startY: e.clientY, moved: false };
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
  }, [onWindowMove, onWindowUp]);

  const labelOffsetFor = (constraintId: string, defaultDir: Point2D = { x: 0, y: 1 }): Point2D =>
    dragOffsets[constraintId]
    || visualMetadata[constraintId]?.labelOffset
    || { x: defaultDir.x * DEFAULT_LABEL_DISTANCE, y: defaultDir.y * DEFAULT_LABEL_DISTANCE };

  const arrowFlipFor = (constraintId: string) => visualMetadata[constraintId]?.arrowFlip ?? false;

  const toggleArrowFlip = useCallback((constraintId: string) => (e: any) => {
    e.stopPropagation();
    onToggleArrowFlip?.(constraintId);
  }, [onToggleArrowFlip]);

  return { startDrag, isHighlighted, labelOffsetFor, arrowFlipFor, toggleArrowFlip };
}
