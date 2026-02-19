import type { ShapeReference } from '../../geometry';
import type { MeshData } from '../mesh/MeshData';

/** Sketch built successfully */
export interface SketchBuiltResponse {
    type: 'sketchBuilt';
    sketchId: string;
    geometry: ShapeReference;
    meshData: MeshData;
}
