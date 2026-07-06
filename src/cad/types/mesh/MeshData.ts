/** Mesh data transferred from worker to main thread */
export interface MeshData {
    /** Face vertices (positions) */
    faceVertices: Float32Array;
    /** Face normals */
    faceNormals: Float32Array;
    /** Face indices */
    faceIndices: Uint32Array;
    /** Edge vertices (positions) */
    edgeVertices: Float32Array;
    /** Edge indices */
    edgeIndices: Uint32Array;
    /** Maps each triangle index to its parent CAD face ID */
    faceMapping?: Uint32Array;
    /**
     * Owning feature id per CAD face, indexed by the same face id `faceMapping`
     * reports (0-based TopExp face order). `null` when a face could not be
     * attributed to a feature. Only populated by full rebuilds. See
     * `src/cad/engine/faceAttribution.ts`.
     */
    faceOwners?: (string | null)[];
    /** Maps each edge segment index to its parent topological edge ID (0-based) */
    edgeMapping?: Uint32Array;
    /** Number of unique topological edges */
    edgeCount: number;
}
