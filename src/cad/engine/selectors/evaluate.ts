/**
 * Selector evaluation — match a {@link SelectorNode} AST against a list of
 * {@link SubShapeDescriptor}s, returning the matching sub-shape indices.
 *
 * Pure array-in / array-out (no OCC). This is the semantic core: each predicate
 * is a clean-room port of the corresponding CadQuery selector (Apache-2.0,
 * reference only). Tunable tolerances default to hand-fixture-friendly values;
 * callers with real geometry may widen them.
 */

import type { Axis, SelectorNode, SubShapeDescriptor, Vec3 } from './types';

export interface EvalOptions {
  /** Max |sin(angle)| treated as "aligned" for parallel/perpendicular/directed. */
  angleTol?: number;
  /** Coordinate span within which centroids are treated as co-planar (min/max grouping). */
  coordTol?: number;
  /** Relative span within which radii are treated as equal (radius grouping). */
  radiusTol?: number;
}

const DEFAULTS: Required<EvalOptions> = { angleTol: 1e-3, coordTol: 1e-6, radiusTol: 1e-4 };

const axisUnit = (axis: Axis): Vec3 =>
  axis === 'X' ? { x: 1, y: 0, z: 0 } : axis === 'Y' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };

const comp = (v: Vec3, axis: Axis): number => (axis === 'X' ? v.x : axis === 'Y' ? v.y : v.z);

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** dot(unit(dir), axisUnit) — direction is normalized defensively. */
function alignment(dir: Vec3, axis: Axis): number {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  return comp({ x: dir.x / len, y: dir.y / len, z: dir.z / len }, axis);
}

/**
 * Group pre-sorted values whose keys are within `tol` into ordered buckets, so
 * `>Z` returns every co-planar top face (a tie) and `>Z[n]` selects the n-th
 * bucket. `values` must already be sorted in the desired direction; each bucket
 * is anchored on its first member's key (buckets are contiguous in sort order).
 */
function bucketByKey(values: { index: number; key: number }[], tol: number): number[][] {
  const buckets: number[][] = [];
  let anchor = NaN;
  for (const v of values) {
    if (buckets.length && Math.abs(v.key - anchor) <= tol) {
      buckets[buckets.length - 1].push(v.index);
    } else {
      buckets.push([v.index]);
      anchor = v.key;
    }
  }
  return buckets;
}

function dirMinMax(
  items: SubShapeDescriptor[],
  axis: Axis,
  max: boolean,
  nth: number,
  tol: number
): number[] {
  if (items.length === 0) return [];
  const values = items
    .map((i) => ({ index: i.index, key: comp(i.centroid, axis) }))
    .sort((a, b) => (max ? b.key - a.key : a.key - b.key));
  const buckets = bucketByKey(values, tol);
  return buckets[nth] ?? [];
}

function radiusNth(items: SubShapeDescriptor[], nth: number, max: boolean, relTol: number): number[] {
  const withR = items.filter((i) => i.radius !== undefined);
  if (withR.length === 0) return [];
  const values = withR
    .map((i) => ({ index: i.index, key: i.radius as number }))
    .sort((a, b) => (max ? b.key - a.key : a.key - b.key));
  // Group by *relative* radius difference.
  const buckets: number[][] = [];
  let anchor = NaN;
  for (const v of values) {
    const rel = Math.abs(v.key - anchor) / Math.max(Math.abs(anchor), 1e-9);
    if (buckets.length && rel <= relTol) buckets[buckets.length - 1].push(v.index);
    else { buckets.push([v.index]); anchor = v.key; }
  }
  return buckets[nth] ?? [];
}

/**
 * Evaluate a selector AST against `items`, returning matching indices (ascending).
 */
export function evaluate(
  node: SelectorNode,
  items: SubShapeDescriptor[],
  options: EvalOptions = {}
): number[] {
  const opts = { ...DEFAULTS, ...options };
  const universe = () => items.map((i) => i.index);
  const asSet = (idxs: number[]) => new Set(idxs);
  const sortAsc = (idxs: Iterable<number>) => [...idxs].sort((a, b) => a - b);

  switch (node.kind) {
    case 'type':
      return items.filter((i) => i.geomType === node.geomType).map((i) => i.index);

    case 'parallel':
      return items
        .filter((i) => i.direction && Math.abs(alignment(i.direction, node.axis)) >= 1 - opts.angleTol)
        .map((i) => i.index);

    case 'perpendicular':
      return items
        .filter((i) => i.direction && Math.abs(alignment(i.direction, node.axis)) <= opts.angleTol)
        .map((i) => i.index);

    case 'directed': {
      const want = node.positive ? 1 : -1;
      return items
        .filter((i) => i.direction && alignment(i.direction, node.axis) * want >= 1 - opts.angleTol)
        .map((i) => i.index);
    }

    case 'dirMinMax':
      return dirMinMax(items, node.axis, node.max, node.nth ?? 0, opts.coordTol);

    case 'radiusNth':
      return radiusNth(items, node.nth, node.max, opts.radiusTol);

    case 'near': {
      if (items.length === 0) return [];
      let best = items[0];
      let bestD = dist(best.centroid, node.point);
      for (const i of items) {
        const d = dist(i.centroid, node.point);
        if (d < bestD) { best = i; bestD = d; }
      }
      return [best.index];
    }

    case 'and': {
      const right = asSet(evaluate(node.right, items, options));
      return sortAsc(evaluate(node.left, items, options).filter((i) => right.has(i)));
    }

    case 'or': {
      const merged = asSet(evaluate(node.left, items, options));
      for (const i of evaluate(node.right, items, options)) merged.add(i);
      return sortAsc(merged);
    }

    case 'not': {
      const excluded = asSet(evaluate(node.operand, items, options));
      return sortAsc(universe().filter((i) => !excluded.has(i)));
    }
  }
}
