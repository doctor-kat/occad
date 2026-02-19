import type { ExtrudeParams } from '@/cad/types';

/** Extrude a sketch to create a 3D feature */
export interface ExtrudeSketchRequest {
    type: 'extrudeSketch';
    featureId: string;
    sketchId: string;
    params: ExtrudeParams;
}
