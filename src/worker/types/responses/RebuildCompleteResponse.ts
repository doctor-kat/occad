
import type { MeshData, SketchEdgeData, FeatureRefEnrichment } from '@/cad/types';

/** Full model rebuild complete */
export interface RebuildCompleteResponse {
    type: 'rebuildComplete';
    meshData: MeshData;
    shapeId: string;
    sketchEdges?: Record<string, SketchEdgeData>;
    /**
     * Lazily-captured fingerprint upgrades for modification selections, applied
     * by the main thread without bumping version. Absent when nothing new was
     * captured this rebuild. See DETERMINISTIC.md step 3b.
     */
    refEnrichments?: FeatureRefEnrichment[];
}
