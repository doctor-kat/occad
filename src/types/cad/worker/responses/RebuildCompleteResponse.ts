import type { MeshData } from '../mesh/MeshData';
import type { SketchEdgeData } from '../mesh/SketchEdgeData';

/** Full model rebuild complete */
export interface RebuildCompleteResponse {
    type: 'rebuildComplete';
    meshData: MeshData;
    shapeId: string;
    sketchEdges?: Record<string, SketchEdgeData>;
}
