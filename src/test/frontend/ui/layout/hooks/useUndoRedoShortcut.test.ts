import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUndoRedoShortcut } from '@/frontend/ui/layout/hooks/useUndoRedoShortcut';

function press(key: string, opts: Partial<KeyboardEventInit> & { target?: EventTarget } = {}) {
  const { target, ...init } = opts;
  const e = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...init });
  (target ?? window).dispatchEvent(e);
  return e;
}

describe('useUndoRedoShortcut', () => {
  let undo: ReturnType<typeof vi.fn>;
  let redo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    undo = vi.fn();
    redo = vi.fn();
    renderHook(() => useUndoRedoShortcut(undo, redo));
  });

  it('fires undo on Ctrl+Z and redo on Ctrl+Y / Ctrl+Shift+Z', () => {
    press('z');
    expect(undo).toHaveBeenCalledTimes(1);

    press('y');
    press('z', { shiftKey: true });
    expect(redo).toHaveBeenCalledTimes(2);
  });

  it('stays live during a sketch session so in-sketch undo is reachable', () => {
    // The hook is intentionally sketch-agnostic: projectStore routes undo to the
    // in-sketch stack while a session is open. A guard here would make the
    // ephemeral tier unreachable from the keyboard.
    press('z');
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('ignores the shortcut while typing into a field', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('z', { target: input });
    expect(undo).not.toHaveBeenCalled();
    input.remove();
  });

  it('ignores keys without a modifier', () => {
    press('z', { ctrlKey: false });
    expect(undo).not.toHaveBeenCalled();
  });
});
