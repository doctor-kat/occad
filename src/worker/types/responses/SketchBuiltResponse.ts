
import type { ShapeReference, MeshData } from '@/cad/types';

/** Sketch built successfully */
export interface SketchBuiltResponse {
    type: 'sketchBuilt';
    sketchId: string;
    geometry: ShapeReference;
    meshData: MeshData;
}
