/** The edges forming the loop containing a picked edge (see GetEdgeLoopRequest). */
export interface EdgeLoopResponse {
    type: 'edgeLoop';
    requestId: string;
    /** 0-based global edge indices in the loop (includes the picked edge). */
    edgeIndices: number[];
}
