/**
 * Snapshot undo/redo, extracted from useCADState into a standalone deep module.
 *
 * The project state is fully serializable and every edit already produces a
 * fresh immutable object, so a "snapshot" is just a retained reference — cheap
 * to keep. Callers record a snapshot only when a *model* edit lands (the store
 * gates this on `version` changing, so derived enrichments that keep `version`
 * are invisible to undo). Undo/redo then replay whole prior states.
 */

export interface History<T> {
  undo: T[];
  redo: T[];
}

/** Cap on retained snapshots per direction. */
export const MAX_HISTORY = 100;

export function emptyHistory<T>(): History<T> {
  return { undo: [], redo: [] };
}

export const canUndo = <T>(h: History<T>): boolean => h.undo.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.redo.length > 0;

/**
 * Record `prevState` as the point we can return to, and clear the redo stack
 * (a fresh edit invalidates any redo future). Returns a new History; the input
 * is not mutated.
 */
export function record<T>(h: History<T>, prevState: T): History<T> {
  const undo = [...h.undo, prevState];
  if (undo.length > MAX_HISTORY) undo.shift();
  return { undo, redo: [] };
}

/**
 * Move one step back: pops the last snapshot as the restored state and pushes
 * `current` onto redo. Returns null when there is nothing to undo.
 */
export function undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (h.undo.length === 0) return null;
  const undoStack = [...h.undo];
  const state = undoStack.pop()!;
  return { history: { undo: undoStack, redo: [...h.redo, current] }, state };
}

/**
 * Move one step forward: pops the last redo snapshot as the restored state and
 * pushes `current` back onto undo. Returns null when there is nothing to redo.
 */
export function redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (h.redo.length === 0) return null;
  const redoStack = [...h.redo];
  const state = redoStack.pop()!;
  return { history: { undo: [...h.undo, current], redo: redoStack }, state };
}
