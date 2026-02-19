/** Rebuild progress update */
export interface RebuildProgressResponse {
    type: 'rebuildProgress';
    progress: number;
    currentFeatureId: string;
}
