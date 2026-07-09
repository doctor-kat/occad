import type { StableRef } from './StableRef';

/**
 * A geometry selection reference as stored in feature params: either a legacy
 * `edge-N` / `face-N` string, or a richer {@link StableRef}. The worker resolver
 * accepts both, so persisted projects keep working without migration.
 */
export type GeometryRef = string | StableRef;
