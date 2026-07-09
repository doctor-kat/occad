import type { GeometryRef } from './GeometryRef';

/**
 * A worker→main enrichment: the upgraded (fingerprinted) refs for one selection
 * field of one feature, captured lazily during rebuild. The main thread persists
 * `refs` into `feature.parameters[key]` *without bumping version* (it is derived
 * data, not a user edit). See `ROADMAP.md` (Deterministic topology).
 */
export interface FeatureRefEnrichment {
  featureId: string;
  /** Which selection field this replaces: fillet/chamfer use 'edges', shell/offset 'faces'. */
  key: 'edges' | 'faces';
  refs: GeometryRef[];
}
