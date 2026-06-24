/**
 * Deterministic build-order utilities.
 *
 * The feature tree (UI) and the parametric rebuild (worker) must agree on a
 * single, total, deterministic ordering of sketches and features. Historically
 * both sorted by `createdAt` alone, which has two problems:
 *
 *  1. Items created in the same millisecond have equal keys, so their relative
 *     order depended on `Array.sort` stability / insertion order — non-deterministic
 *     across the sketch/feature arrays.
 *  2. Reordering a feature in the tree had no effect, because the array order was
 *     ignored and `createdAt` never changed.
 *
 * This module defines the authoritative ordering used by *both* layers:
 *  - primary key: `sequence` if set (an explicit reorder override in the
 *    epoch-ms domain), otherwise `createdAt`;
 *  - tiebreak: `id`, lexicographically, so the order is a *total* order that
 *    never depends on sort stability.
 */

/** Minimal shape of anything that participates in the build order. */
export interface OrderableItem {
  id: string;
  createdAt: number;
  /**
   * Explicit ordering override set when the item is reordered. Lives in the
   * same numeric domain as `createdAt` (epoch milliseconds) so the two can be
   * compared directly; a reordered item is slotted *between* its neighbours'
   * effective keys.
   */
  sequence?: number;
}

/** The authoritative ordering key: explicit `sequence` if set, else `createdAt`. */
export function orderKey(item: OrderableItem): number {
  return item.sequence ?? item.createdAt;
}

/**
 * Total, deterministic comparator for build items. Sort an array with this and
 * the result is identical regardless of input order or `Array.sort` stability.
 */
export function compareBuildOrder(a: OrderableItem, b: OrderableItem): number {
  const ka = orderKey(a);
  const kb = orderKey(b);
  if (ka !== kb) return ka - kb;
  // Equal primary keys (e.g. same-millisecond creation): break by id so the
  // order is fully determined by the data, not by who happened to be first.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
