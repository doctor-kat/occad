import type { SketchElement, SketchPlane } from '../../sketch-elements';

/** Build a sketch from 2D elements into a wire/face */
export interface BuildSketchRequest {
    type: 'buildSketch';
    sketchId: string;
    plane: SketchPlane;
    elements: SketchElement[];
}
