import { SketchPrimitiveType } from './Sketch';
import { StableRef } from '../geometry/shapeRefs';

export interface SketchPrimitive {
  id: string;
  type: SketchPrimitiveType;
  /** planegcs data (references point IDs, contains numerical values) */
  data: any;
  /** Whether this primitive is fixed in the solver */
  fixed: boolean;
  /** Whether this is external geometry projected from the solid */
  isExternal?: boolean;
  /** Source OCC tag if external — bare positional `edge-N`/`vertex-N`/`face-N` (fallback / dedup key) */
  sourceId?: string;
  /**
   * Geometry-anchored upgrade of `sourceId`, captured lazily by the worker during
   * rebuild (fingerprint + index). Preferred over `sourceId` when resolving the
   * external sub-shape, so it survives an upstream edit that renumbers the index
   * map. See `ROADMAP.md` (Deterministic topology).
   */
  sourceRef?: StableRef;
}
