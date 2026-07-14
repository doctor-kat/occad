import { useEffect, type MutableRefObject } from 'react';
import type { Point2D, Sketch, SketchElement } from '@/cad/types';

export interface SketchKeyboardActionsDeps {
  selectedElementIds: Set<string>;
  sketch: Sketch;
  onElementsChange: (sketchId: string, elements: SketchElement[]) => void;
  onCompletePolygon: () => void;
  clearSketchSelection: () => void;
  setSketchElementSelection: (ids: string[]) => void;
  setHoveredElementId: (id: string | null) => void;
  onExitSketch?: () => void;
  /** True (via ref read) when the Dimension tool has an armed first pick. */
  pendingDimTargetRef: MutableRefObject<{ id: string; kind: 'point' | 'line' } | null>;
  setPendingDimTarget: (target: { id: string; kind: 'point' | 'line' } | null) => void;
  /** In-progress draw-tool points (via ref read) and their setter. */
  currentPointsRef: MutableRefObject<Point2D[]>;
  setPoints: (points: Point2D[]) => void;
  setPreviewElement: (element: SketchElement | null) => void;
  setSnapToGrid: (updater: (prev: boolean) => boolean) => void;
  setShowGrid: (updater: (prev: boolean) => boolean) => void;
}

/**
 * Wires the sketch overlay's global keyboard shortcuts: Ctrl/Cmd+A select-all,
 * G/H grid toggles, Enter to complete a polygon, Escape to abort/exit, and
 * Delete/Backspace to remove the current selection.
 */
export function useSketchKeyboardActions({
  selectedElementIds,
  sketch,
  onElementsChange,
  onCompletePolygon,
  clearSketchSelection,
  setSketchElementSelection,
  setHoveredElementId,
  onExitSketch,
  pendingDimTargetRef,
  setPendingDimTarget,
  currentPointsRef,
  setPoints,
  setPreviewElement,
  setSnapToGrid,
  setShowGrid,
}: SketchKeyboardActionsDeps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Select all sketch entities (Ctrl/Cmd+A) — Del then deletes them.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setSketchElementSelection(sketch.elements.map((el) => el.id));
        return;
      }

      // Toggle grid snap
      if (e.key === 'g' || e.key === 'G') {
        setSnapToGrid((prev) => !prev);
        return;
      }

      // Toggle grid visibility (independent of snapping)
      if (e.key === 'h' || e.key === 'H') {
        setShowGrid((prev) => !prev);
        return;
      }

      // Complete polygon
      if (e.key === 'Enter') {
        onCompletePolygon();
        return;
      }

      // Escape: abort the in-progress element if one is being drawn; otherwise
      // exit sketch mode entirely (falls back to clearing selection if the sketch
      // can't be exited for some reason).
      if (e.key === 'Escape') {
        if (pendingDimTargetRef.current) {
          setPendingDimTarget(null);
        } else if (currentPointsRef.current.length > 0) {
          setPoints([]);
          setPreviewElement(null);
        } else if (onExitSketch) {
          onExitSketch();
        } else {
          clearSketchSelection();
        }
        return;
      }

      // Deletion
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.size > 0) {
          // Prevent default browser behavior
          e.preventDefault();

          // Filter out selected elements
          const newElements = sketch.elements.filter(
            (element) => !selectedElementIds.has(element.id)
          );
          onElementsChange(sketch.id, newElements);

          // Clear selection
          clearSketchSelection();
          setHoveredElementId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedElementIds,
    sketch.elements,
    sketch.id,
    onElementsChange,
    onCompletePolygon,
    clearSketchSelection,
    setPoints,
    onExitSketch,
    setHoveredElementId,
    setSketchElementSelection,
    setPendingDimTarget,
    pendingDimTargetRef,
    currentPointsRef,
    setPreviewElement,
    setSnapToGrid,
    setShowGrid,
  ]);
}
