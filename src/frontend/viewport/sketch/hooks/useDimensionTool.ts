import { useCallback, useRef, useState } from 'react';
import type { ConstraintInput, Sketch } from '@/cad/types';
import { projectPointOntoLineSegment } from '@/cad/engine/sketch/elementHitTest';

export type DimTarget = { id: string; kind: 'point' | 'line' };

/**
 * Owns the Dimension tool's two-click pick state: the first entity (point
 * primitive or line element) picked, waiting for a second pick to complete the
 * pair, plus which entity is currently hovered. `pendingDimTarget` is mirrored
 * into a ref for the same reason as `currentPointsRef` in SketchOverlay — the
 * point-handle onClick callbacks must stay stable across the first/second click.
 */
export function useDimensionTool(sketch: Sketch, onCreateConstraint?: (input: ConstraintInput) => void) {
  const [pendingDimTarget, setPendingDimTargetState] = useState<DimTarget | null>(null);
  const pendingDimTargetRef = useRef<DimTarget | null>(null);
  const setPendingDimTarget = useCallback((target: DimTarget | null) => {
    pendingDimTargetRef.current = target;
    setPendingDimTargetState(target);
  }, []);
  // Entity (point primitive or line element id) currently under the cursor while
  // in Dimension mode — drives hover highlighting in place of grid/origin snapping.
  const [hoveredDimTargetId, setHoveredDimTargetId] = useState<string | null>(null);

  /** Complete a Dimension-tool pick: arm the first entity, or (on the second
   *  pick) create the appropriate distance constraint between it and this one.
   *  point+point -> p2p_distance; point+line -> p2l_distance (perpendicular);
   *  line+line -> unsupported (no such planegcs primitive). */
  const handleDimensionPick = useCallback(
    (id: string, kind: 'point' | 'line') => {
      const armed = pendingDimTargetRef.current;
      if (!armed) {
        setPendingDimTarget({ id, kind });
        return;
      }
      if (armed.id === id && armed.kind === kind) return; // same target again — no-op

      if (armed.kind === 'point' && kind === 'point') {
        const p1 = sketch.primitives?.find((p) => p.id === armed.id)?.data;
        const p2 = sketch.primitives?.find((p) => p.id === id)?.data;
        if (p1 && p2) {
          onCreateConstraint?.({
            kind: 'distance',
            p1Id: armed.id,
            p2Id: id,
            distance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
          });
        }
      } else if (armed.kind === 'line' && kind === 'line') {
        console.warn('Dimension tool: line-to-line distance is not supported (no planegcs primitive).');
      } else {
        const pointId = armed.kind === 'point' ? armed.id : id;
        const lineId = armed.kind === 'line' ? armed.id : id;
        const pointData = sketch.primitives?.find((p) => p.id === pointId)?.data;
        const linePrim = sketch.primitives?.find((p) => p.id === lineId && p.type === 'line');
        const lineStart = linePrim ? sketch.primitives?.find((p) => p.id === linePrim.data.p1_id)?.data : undefined;
        const lineEnd = linePrim ? sketch.primitives?.find((p) => p.id === linePrim.data.p2_id)?.data : undefined;
        if (pointData && lineStart && lineEnd) {
          const { distance } = projectPointOntoLineSegment(pointData, lineStart, lineEnd);
          onCreateConstraint?.({ kind: 'point-line-distance', pointId, lineId, distance });
        }
      }
      setPendingDimTarget(null);
    },
    [sketch.primitives, onCreateConstraint, setPendingDimTarget]
  );

  const resetDimensionState = useCallback(() => {
    setPendingDimTarget(null);
    setHoveredDimTargetId(null);
  }, [setPendingDimTarget]);

  return {
    pendingDimTarget,
    pendingDimTargetRef,
    setPendingDimTarget,
    hoveredDimTargetId,
    setHoveredDimTargetId,
    handleDimensionPick,
    resetDimensionState,
  };
}
