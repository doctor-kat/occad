import { useEffect } from 'react';

// Global undo/redo shortcuts: Ctrl/Cmd+Z, and Ctrl/Cmd+Shift+Z or Ctrl+Y for
// redo. Suppressed while typing into a field so model history can't fire from a
// text edit. These stay live during a sketch: projectStore routes undo/redo to
// the in-sketch stack while a sketch session is open and to the version timeline
// otherwise, so the shortcut does not need to know which tier is active.
export function useUndoRedoShortcut(
  undo: () => void,
  redo: () => void,
) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;

      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      e.preventDefault();
      if (isRedo) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
}
