import type { SketchElement, SketchPlane } from '@/cad/types';

/** Build a sketch from 2D elements into a wire/face */
export interface BuildSketchRequest {
    type: 'buildSketch';
    sketchId: string;
    plane: SketchPlane;
    elements: SketchElement[];
}
