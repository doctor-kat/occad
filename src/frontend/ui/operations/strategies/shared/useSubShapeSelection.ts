import { useEffect, useState } from 'react';

/**
 * Manual edge/face selection list, seeded once from `initial` and then
 * appended to whenever the viewport reports a new pick — the same behavior
 * fillet/chamfer/shell relied on when this lived inline in OperationPanel.
 */
function useSubShapeSelection(initial: string[], viewportIndex: number | null, refPrefix: string) {
  const [selected, setSelected] = useState<string[]>(initial);

  useEffect(() => {
    if (viewportIndex === null) return;
    const ref = `${refPrefix}-${viewportIndex}`;
    setSelected((prev) => (prev.includes(ref) ? prev : [...prev, ref]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportIndex]);

  return [selected, setSelected] as const;
}

export function useEdgeSelection(initial: string[], selectedEdgeIndex: number | null) {
  return useSubShapeSelection(initial, selectedEdgeIndex, 'edge');
}

export function useFaceSelection(initial: string[], selectedFaceId: number | null) {
  return useSubShapeSelection(initial, selectedFaceId, 'face');
}

/**
 * Manual feature-id selection list (union/intersect), seeded once and then
 * appended to whenever the feature tree reports a new pick.
 */
export function useFeatureSelection(initial: string[], selectedTreeItem: string | null | undefined, isFeature: (id: string) => boolean) {
  const [selected, setSelected] = useState<string[]>(initial);

  useEffect(() => {
    if (!selectedTreeItem || !isFeature(selectedTreeItem)) return;
    setSelected((prev) => (prev.includes(selectedTreeItem) ? prev : [...prev, selectedTreeItem]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTreeItem]);

  return [selected, setSelected] as const;
}
