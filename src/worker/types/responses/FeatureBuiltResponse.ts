
import type { ShapeReference, MeshData } from '@/cad/types';

/** Feature built successfully */
export interface FeatureBuiltResponse {
    type: 'featureBuilt';
    featureId: string;
    geometry: ShapeReference;
    meshData: MeshData;
}
