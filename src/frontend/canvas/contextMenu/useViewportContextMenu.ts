import { useCallback } from "react";
import type { MouseEvent } from "react";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import { resolveContextTarget } from "./contextTarget";

/**
 * SolidWorks-style right-click menu handler for the viewport. The camera is on
 * the middle button (RIGHT is unbound in OrbitControls), so the right button is
 * free here. The entity under the cursor is whatever is currently hovered
 * (tracked continuously on pointer-move); empty space falls back to the selection.
 */
export function useViewportContextMenu(inSketchMode: boolean) {
  return useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      const s = useViewportStore.getState();
      const target = resolveContextTarget({
        inSketchMode,
        hoveredFaceId: s.hoveredFaceId,
        hoveredEdgeIndex: s.hoveredEdgeIndex,
        hoveredSketchElementId: s.hoveredSketchElementId,
        selectedFaceId: s.selectedFaceId,
        selectedEdgeIndex: s.selectedEdgeIndex,
        selectedSketchElementIds: s.selectedSketchElementIds,
      });
      s.openContextMenu({ x: e.clientX, y: e.clientY, target });
    },
    [inSketchMode],
  );
}
