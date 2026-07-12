import { useEffect, useRef } from 'react';
import type { PanelDraft } from '../types';

/**
 * Pushes the panel's current draft (or null while invalid) to the shell.
 * Content-compared via JSON so panels can build the draft inline during
 * render without maintaining a dependency array.
 */
export function useReportDraft(
  onChange: (draft: PanelDraft | null) => void,
  draft: PanelDraft | null,
) {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const contentKey = JSON.stringify(draft);
  useEffect(() => {
    onChange(draftRef.current);
  }, [contentKey, onChange]);
}
