import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStorageUsage, formatBytes } from '@/frontend/shared/storageUsage';
import { saveTimeline, deleteTimeline } from '@/frontend/shared/versionStorage';

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(null)).toBe('—');
  });
});

describe('getStorageUsage', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the origin estimate and computes percent', async () => {
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ usage: 2_000_000, quota: 10_000_000 }) },
    });
    const usage = await getStorageUsage('proj-x');
    expect(usage.totalUsage).toBe(2_000_000);
    expect(usage.quota).toBe(10_000_000);
    expect(usage.percentUsed).toBeCloseTo(20);
  });

  it('falls back gracefully when estimate is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const usage = await getStorageUsage('proj-x');
    expect(usage.totalUsage).toBeNull();
    expect(usage.quota).toBeNull();
    expect(usage.percentUsed).toBeNull();
  });

  it('sums the per-bucket sizes', async () => {
    localStorage.setItem('occad-project', JSON.stringify({ hello: 'world' }));
    await deleteTimeline('proj-x');
    await saveTimeline('proj-x', { entries: [{ id: 'a' }], currentId: 'a' });

    const usage = await getStorageUsage('proj-x');
    expect(usage.buckets.project).toBeGreaterThan(0);
    expect(usage.buckets.versionHistory).toBeGreaterThan(0);
  });
});
