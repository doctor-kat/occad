/**
 * Best-effort browser storage accounting for the settings panel.
 *
 * The authoritative origin total comes from the Storage API
 * (`navigator.storage.estimate()`), which covers IndexedDB + localStorage +
 * caches together. We also compute a couple of per-bucket sums we control
 * (the persisted project in localStorage, the version timeline in IndexedDB)
 * so the UI can show a breakdown. All figures are in bytes.
 */

import { loadTimeline } from '@/frontend/shared/versionStorage';

const PROJECT_STORAGE_KEY = 'occad-project';

export interface StorageUsage {
  /** Origin total reported by the Storage API, or null if unavailable. */
  totalUsage: number | null;
  /** Origin quota reported by the Storage API, or null if unavailable. */
  quota: number | null;
  /** totalUsage / quota as a 0–100 percentage, or null if either is missing. */
  percentUsed: number | null;
  buckets: {
    /** Approx bytes of the persisted CADProject in localStorage. */
    project: number;
    /** Approx bytes of the persisted version timeline in IndexedDB. */
    versionHistory: number;
  };
}

/** UTF-8 byte length of a string (falls back to char count if unavailable). */
function byteLength(str: string): number {
  try {
    return new TextEncoder().encode(str).length;
  } catch {
    return str.length;
  }
}

function projectBytes(): number {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    return raw ? byteLength(raw) : 0;
  } catch {
    return 0;
  }
}

async function versionHistoryBytes(projectId: string): Promise<number> {
  try {
    const timeline = await loadTimeline(projectId);
    return timeline ? byteLength(JSON.stringify(timeline)) : 0;
  } catch {
    return 0;
  }
}

/** Gather storage usage for the current project. Never throws. */
export async function getStorageUsage(projectId: string): Promise<StorageUsage> {
  let totalUsage: number | null = null;
  let quota: number | null = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      totalUsage = typeof est.usage === 'number' ? est.usage : null;
      quota = typeof est.quota === 'number' ? est.quota : null;
    }
  } catch {
    // leave as null
  }

  const percentUsed =
    totalUsage != null && quota != null && quota > 0
      ? Math.min(100, (totalUsage / quota) * 100)
      : null;

  return {
    totalUsage,
    quota,
    percentUsed,
    buckets: {
      project: projectBytes(),
      versionHistory: await versionHistoryBytes(projectId),
    },
  };
}

/** Format a byte count as a human-readable string, e.g. "1.4 MB". */
export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || Number.isInteger(value) ? 0 : 1)} ${units[i]}`;
}
