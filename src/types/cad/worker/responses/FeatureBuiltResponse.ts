import type { ShapeReference } from '../../geometry';
import type { MeshData } from '../mesh/MeshData';

/** Feature built successfully */
export interface FeatureBuiltResponse {
    type: 'featureBuilt';
    featureId: string;
    geometry: ShapeReference;
    meshData: MeshData;
}
