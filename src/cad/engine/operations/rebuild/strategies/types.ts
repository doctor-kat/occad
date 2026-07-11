/**
 * Per-operation rebuild strategies — mirrors the tagged-result + registry
 * pattern already used by src/cad/engine/sketch/drawTools/.
 */

type TopoDS_Shape = any;
import type { Feature, FeatureRefEnrichment } from '@/cad/types';
import type { WorkerContext } from '../../../workerContext';

export interface RebuildContext {
  ctx: WorkerContext;
  feature: Feature;
  /** The running body before this feature is applied, or null if none yet. */
  currentBody: TopoDS_Shape | null;
  /** Each feature's isolated solid (pre boss/cut auto-union), keyed by feature id. */
  featureSolids: Map<string, TopoDS_Shape>;
  /** Fingerprint upgrades captured for modification selections; strategies push onto this. */
  refEnrichments: FeatureRefEnrichment[];
}

export type StrategyResult =
  /** A new solid was produced; the loop auto-combines it into the running body
   *  via `combine` (boss = union, cut = subtract) and records it in `featureSolids`. */
  | { kind: 'produce'; shape: TopoDS_Shape | null; combine: 'union' | 'subtract' }
  /** The running body was replaced in place (modifications, transforms,
   *  standalone booleans) — no auto-combine. */
  | { kind: 'replace'; body: TopoDS_Shape | null }
  /** No geometry to build (e.g. Measure) — body is unchanged. */
  | { kind: 'noop' };

export type FeatureStrategy = (rc: RebuildContext) => StrategyResult;
