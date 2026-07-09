import type { StableRef } from './StableRef';

/**
 * A worker→main enrichment for a sketch's *external geometry* reference, captured
 * lazily during rebuild. External sketch primitives are anchored to a solid's
 * sub-shape by `sourceId` (a bare positional `edge-N` / `vertex-N` / `face-N`
 * tag), which silently rebinds after an upstream edit renumbers the index map.
 * The worker re-resolves the tag against the body where it is still valid,
 * captures the matching {@link StableRef} (with fingerprint), and the main thread
 * persists it into `primitive.sourceRef` *without bumping version* — the
 * geometry-anchored ref then survives later renumbers. See `ROADMAP.md`
 * (Deterministic topology).
 */
export interface SketchRefEnrichment {
  sketchId: string;
  primitiveId: string;
  ref: StableRef;
}
