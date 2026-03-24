
import type { ShapeReference, MeshData, Sketch } from '@/cad/types';

/** Sketch built successfully */
export interface SketchBuiltResponse {
    type: 'sketchBuilt';
    sketchId: string;
    geometry: ShapeReference;
    meshData: MeshData;
    solvedSketch?: Sketch;
}
