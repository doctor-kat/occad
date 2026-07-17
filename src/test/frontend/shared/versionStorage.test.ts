import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveTimeline,
  loadTimeline,
  deleteTimeline,
  createDebouncedSaver,
} from '@/frontend/shared/versionStorage';

describe('versionStorage', () => {
  beforeEach(async () => {
    // Isolate tests: clear any persisted keys used below.
    await deleteTimeline('proj-a');
    await deleteTimeline('proj-b');
  });

  it('round-trips a saved timeline', async () => {
    const timeline = { entries: [{ id: 'x', label: 'root' }], currentId: 'x' };
    await saveTimeline('proj-a', timeline);
    const loaded = await loadTimeline('proj-a');
    expect(loaded).toEqual(timeline);
  });

  it('returns null for a missing key', async () => {
    expect(await loadTimeline('nope')).toBeNull();
  });

  it('overwrites on repeated save', async () => {
    await saveTimeline('proj-a', { v: 1 });
    await saveTimeline('proj-a', { v: 2 });
    expect(await loadTimeline('proj-a')).toEqual({ v: 2 });
  });

  it('deletes a stored timeline', async () => {
    await saveTimeline('proj-a', { v: 1 });
    await deleteTimeline('proj-a');
    expect(await loadTimeline('proj-a')).toBeNull();
  });

  it('isolates different project ids', async () => {
    await saveTimeline('proj-a', { who: 'a' });
    await saveTimeline('proj-b', { who: 'b' });
    expect(await loadTimeline('proj-a')).toEqual({ who: 'a' });
    expect(await loadTimeline('proj-b')).toEqual({ who: 'b' });
  });

  describe('createDebouncedSaver', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('coalesces rapid calls and persists the latest', async () => {
      const save = createDebouncedSaver(200);
      save('proj-a', { v: 1 });
      save('proj-a', { v: 2 });
      save('proj-a', { v: 3 });

      vi.advanceTimersByTime(250);
      // Let the async put settle.
      await vi.runAllTimersAsync();
      vi.useRealTimers();

      expect(await loadTimeline('proj-a')).toEqual({ v: 3 });
    });
  });
});
