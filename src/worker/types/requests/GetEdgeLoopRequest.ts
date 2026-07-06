/** Get the edges forming the loop (bounding wire) that contains a picked edge. */
export interface GetEdgeLoopRequest {
    type: 'getEdgeLoop';
    requestId: string;
    /** CAD shape to query (typically CURRENT_REBUILD_SHAPE). */
    shapeId: string;
    /** 0-based global edge index (as reported by the mesh's edgeMapping). */
    edgeIndex: number;
}
