import type { Sketch } from '@/cad/types';

/** Build a sketch from its full state into a wire/face */
export interface BuildSketchRequest {
    type: 'buildSketch';
    sketch: Sketch;
    bodyId?: string;
}
