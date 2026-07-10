import { useEffect, useState } from 'react';

/**
 * Manual edge/face selection list, seeded once from `initial` and then
 * appended to whenever the viewport reports a new pick — the same behavior
 * fillet/chamfer/shell relied on when this lived inline in OperationPanel.
 * `refPrefix` is `'edge'` or `'face'`; add a `useFaceSelection` wrapper here
 * (mirroring `useEdgeSelection`) when Shell/Offset migrate to Strategy panels.
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
