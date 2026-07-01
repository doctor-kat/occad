
import type { ShapeReference, MeshData, Sketch } from '@/cad/types';

/** Sketch built successfully */
export interface SketchBuiltResponse {
    type: 'sketchBuilt';
    sketchId: string;
    /** Undefined when the profile could not be faced (constraints still round-trip via solvedSketch). */
    geometry?: ShapeReference;
    meshData?: MeshData;
    solvedSketch?: Sketch;
}
