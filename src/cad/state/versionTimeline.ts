/**
 * Linear, branch-appending, Google-Docs-style version timeline of whole-project
 * snapshots. Unlike twin-stack undo/redo (`history.ts`), nothing is ever
 * deleted: restoring an older version appends a NEW entry carrying that
 * version's snapshot rather than discarding the "future" branch. Retention is
 * unlimited.
 *
 * Pure module: no side effects, no persistence, no React. Generic over the
 * snapshot type `T` (treat it as opaque — this module does not know about
 * CADProject).
 */

export interface VersionEntry<T> {
  id: string;
  label: string;
  timestamp: number;
  snapshot: T;
  parentId: string | null;
}

export interface Timeline<T> {
  /** Append-only; entries are never removed. */
  entries: VersionEntry<T>[];
  /** The "you are here" marker — id of the current entry. */
  currentId: string;
}

const defaultMakeId = (): string => crypto.randomUUID();

function findEntry<T>(t: Timeline<T>, id: string): VersionEntry<T> | undefined {
  return t.entries.find((e) => e.id === id);
}

/** The entry `currentId` points to. Throws if the timeline is malformed. */
export function current<T>(t: Timeline<T>): VersionEntry<T> {
  const entry = findEntry(t, t.currentId);
  if (!entry) throw new Error(`versionTimeline: currentId "${t.currentId}" not found in entries`);
  return entry;
}

/** Create a fresh timeline with a single root entry. */
export function createTimeline<T>(
  rootSnapshot: T,
  label = 'Initial version',
  makeId: () => string = defaultMakeId,
  now: () => number = Date.now,
): Timeline<T> {
  const id = makeId();
  const root: VersionEntry<T> = {
    id,
    label,
    timestamp: now(),
    snapshot: rootSnapshot,
    parentId: null,
  };
  return { entries: [root], currentId: id };
}

/**
 * Normal "an edit happened" path: appends a new entry whose parent is the
 * current entry, and advances currentId to it.
 */
export function append<T>(
  t: Timeline<T>,
  snapshot: T,
  label: string,
  makeId: () => string = defaultMakeId,
  now: () => number = Date.now,
): Timeline<T> {
  const id = makeId();
  const entry: VersionEntry<T> = {
    id,
    label,
    timestamp: now(),
    snapshot,
    parentId: t.currentId,
  };
  return { entries: [...t.entries, entry], currentId: id };
}

/**
 * Branch-appending restore: appends a NEW entry carrying the snapshot of
 * `id`, parented to the previous currentId, and moves currentId to it.
 * Nothing is deleted. No-op (returns `t` unchanged) if `id` doesn't exist.
 */
export function restore<T>(
  t: Timeline<T>,
  id: string,
  makeId: () => string = defaultMakeId,
  now: () => number = Date.now,
): Timeline<T> {
  const target = findEntry(t, id);
  if (!target) return t;

  const newId = makeId();
  const entry: VersionEntry<T> = {
    id: newId,
    label: `Restored to ${target.label}`,
    timestamp: now(),
    snapshot: target.snapshot,
    parentId: t.currentId,
  };
  return { entries: [...t.entries, entry], currentId: newId };
}

export function canStepBack<T>(t: Timeline<T>): boolean {
  return current(t).parentId !== null;
}

export function canStepForward<T>(t: Timeline<T>): boolean {
  return t.entries.some((e) => e.parentId === t.currentId);
}

/** Move currentId to the current entry's parent (Ctrl+Z). Null if no parent. */
export function stepBack<T>(t: Timeline<T>): { timeline: Timeline<T>; snapshot: T } | null {
  const parentId = current(t).parentId;
  if (parentId === null) return null;
  const parent = findEntry(t, parentId);
  if (!parent) return null;
  return { timeline: { ...t, currentId: parentId }, snapshot: parent.snapshot };
}

/**
 * Move currentId to the most recently created child of the current entry
 * (redo). Null if there is no child.
 */
export function stepForward<T>(t: Timeline<T>): { timeline: Timeline<T>; snapshot: T } | null {
  const children = t.entries.filter((e) => e.parentId === t.currentId);
  if (children.length === 0) return null;
  const newest = children.reduce((a, b) => (b.timestamp >= a.timestamp ? b : a));
  return { timeline: { ...t, currentId: newest.id }, snapshot: newest.snapshot };
}