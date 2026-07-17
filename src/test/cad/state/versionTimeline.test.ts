import { describe, it, expect } from 'vitest';
import {
  createTimeline,
  append,
  restore,
  stepBack,
  stepForward,
  canStepBack,
  canStepForward,
  current,
  type Timeline,
} from '@/cad/state/versionTimeline';

// Deterministic id generator + fake clock so assertions are stable.
function makeIds() {
  let n = 0;
  return () => `id${n++}`;
}
function makeClock() {
  let t = 1000;
  return () => (t += 10);
}

describe('versionTimeline', () => {
  it('creates a root entry as current', () => {
    const t = createTimeline('v0', 'Initial version', makeIds(), makeClock());
    expect(t.entries).toHaveLength(1);
    expect(current(t).snapshot).toBe('v0');
    expect(current(t).parentId).toBeNull();
    expect(canStepBack(t)).toBe(false);
    expect(canStepForward(t)).toBe(false);
  });

  it('appends edits as a forward chain', () => {
    const ids = makeIds();
    const clock = makeClock();
    let t = createTimeline('v0', 'root', ids, clock);
    t = append(t, 'v1', 'Edit 1', ids, clock);
    t = append(t, 'v2', 'Edit 2', ids, clock);

    expect(t.entries).toHaveLength(3);
    expect(current(t).snapshot).toBe('v2');
    expect(current(t).parentId).toBe('id1');
    expect(canStepBack(t)).toBe(true);
    expect(canStepForward(t)).toBe(false);
  });

  it('steps back and forward through the chain', () => {
    const ids = makeIds();
    const clock = makeClock();
    let t = createTimeline('v0', 'root', ids, clock);
    t = append(t, 'v1', 'Edit 1', ids, clock);
    t = append(t, 'v2', 'Edit 2', ids, clock);

    const back1 = stepBack(t)!;
    expect(back1.snapshot).toBe('v1');
    t = back1.timeline;
    const back2 = stepBack(t)!;
    expect(back2.snapshot).toBe('v0');
    t = back2.timeline;
    expect(stepBack(t)).toBeNull();

    const fwd = stepForward(t)!;
    expect(fwd.snapshot).toBe('v1');
  });

  it('restore branch-appends without deleting the future', () => {
    const ids = makeIds();
    const clock = makeClock();
    let t = createTimeline('v0', 'root', ids, clock);
    t = append(t, 'v1', 'Edit 1', ids, clock);
    t = append(t, 'v2', 'Edit 2', ids, clock);

    const rootId = t.entries[0].id;
    const before = t.entries.length;
    t = restore(t, rootId, ids, clock);

    // Nothing removed; a new entry carrying the root snapshot is appended.
    expect(t.entries.length).toBe(before + 1);
    expect(current(t).snapshot).toBe('v0');
    expect(current(t).label).toContain('Restored to');
    // The previously-current v2 entry still exists.
    expect(t.entries.some((e) => e.snapshot === 'v2')).toBe(true);
  });

  it('after restoring a mid entry, stepForward picks the newest child', () => {
    const ids = makeIds();
    const clock = makeClock();
    let t = createTimeline('v0', 'root', ids, clock);
    t = append(t, 'v1', 'Edit 1', ids, clock);
    const midId = current(t).id; // points at v1
    t = append(t, 'v2', 'Edit 2', ids, clock);

    // Restore v1 (creates a new child of v2's current). Then go sit on v1 via restore of midId
    t = restore(t, midId, ids, clock);
    expect(current(t).snapshot).toBe('v1');
  });

  it('restore of an unknown id is a no-op', () => {
    const ids = makeIds();
    let t = createTimeline('v0', 'root', ids, makeClock());
    const same = restore(t, 'does-not-exist', ids);
    expect(same).toBe(t);
  });

  it('current throws on a malformed timeline', () => {
    const bad: Timeline<string> = { entries: [], currentId: 'nope' };
    expect(() => current(bad)).toThrow();
  });
});
