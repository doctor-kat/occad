
import type { MeshData, SketchEdgeData } from '@/cad/types';

/** Full model rebuild complete */
export interface RebuildCompleteResponse {
    type: 'rebuildComplete';
    meshData: MeshData;
    shapeId: string;
    sketchEdges?: Record<string, SketchEdgeData>;
}
