import { useMemo } from 'react';
import { useProjectStore } from '@/frontend/shared/projectStore.ts';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';
import { buildFeatureTree, rollbackBarIndexOf } from '@/cad/state/projectSelectors.ts';

// Reactive reads of the CAD project. Thin subscriptions/selectors over
// projectStore (+ viewportStore for per-item errors). Imperative mutations live
// in projectApi.ts.

/** Subscribe to the current project. */
export const useProject = () => useProjectStore((s) => s.project);

/** The feature-tree rows, recomputed when the project or item errors change. */
export function useFeatureTree() {
  const project = useProjectStore((s) => s.project);
  const itemErrors = useViewportStore((s) => s.itemErrors);
  return useMemo(() => buildFeatureTree(project, itemErrors), [project, itemErrors]);
}

/** The rollback bar's position as a top-level row index. */
export function useRollbackBarIndex() {
  const project = useProjectStore((s) => s.project);
  return useMemo(() => rollbackBarIndexOf(project), [project]);
}

/** The sketch currently being edited (by activeSketchId), if any. */
export function useActiveSketch() {
  const activeSketchId = useViewportStore((s) => s.activeSketchId);
  const sketches = useProjectStore((s) => s.project.sketches);
  return useMemo(
    () => (activeSketchId ? sketches.find((s) => s.id === activeSketchId) : undefined),
    [activeSketchId, sketches]
  );
}
