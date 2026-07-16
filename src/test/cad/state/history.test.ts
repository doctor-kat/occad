import { describe, it, expect } from 'vitest';
import { emptyHistory, record, undo, redo, canUndo, canRedo, MAX_HISTORY } from '@/cad/state/history';

describe('history (snapshot undo/redo)', () => {
  it('starts empty', () => {
    const h = emptyHistory<number>();
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('records a snapshot and clears redo', () => {
    let h = emptyHistory<number>();
    h = record(h, 1);
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
  });

  it('undo restores the last snapshot and pushes current onto redo', () => {
    let h = record(emptyHistory<number>(), 1); // state was 1, now at 2
    const res = undo(h, 2)!;
    expect(res.state).toBe(1);
    expect(canRedo(res.history)).toBe(true);
    expect(canUndo(res.history)).toBe(false);
  });

  it('redo re-applies the undone snapshot', () => {
    let h = record(emptyHistory<number>(), 1);
    const undone = undo(h, 2)!; // now current would be 1, redo holds 2
    const redone = redo(undone.history, 1)!;
    expect(redone.state).toBe(2);
    expect(canUndo(redone.history)).toBe(true);
    expect(canRedo(redone.history)).toBe(false);
  });

  it('steps back through multiple edits in LIFO order', () => {
    let h = emptyHistory<number>();
    h = record(h, 1); // 1 -> 2
    h = record(h, 2); // 2 -> 3
    const a = undo(h, 3)!;
    expect(a.state).toBe(2);
    const b = undo(a.history, 2)!;
    expect(b.state).toBe(1);
  });

  it('a fresh record after undo clears the redo stack', () => {
    let h = record(emptyHistory<number>(), 1);
    const undone = undo(h, 2)!; // redo now holds 2
    const afterEdit = record(undone.history, 1); // new edit 1 -> 9
    expect(canRedo(afterEdit)).toBe(false);
  });

  it('undo/redo are safe no-ops on empty stacks', () => {
    const h = emptyHistory<number>();
    expect(undo(h, 5)).toBeNull();
    expect(redo(h, 5)).toBeNull();
  });

  it('caps the undo stack at MAX_HISTORY', () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < MAX_HISTORY + 20; i++) h = record(h, i);
    expect(h.undo.length).toBe(MAX_HISTORY);
    // oldest entries were dropped
    expect(h.undo[0]).toBe(20);
  });
});
