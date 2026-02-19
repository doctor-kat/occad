import type { ExtrudeParams } from '../../operation-params';

/** Extrude a sketch to create a 3D feature */
export interface ExtrudeSketchRequest {
    type: 'extrudeSketch';
    featureId: string;
    sketchId: string;
    params: ExtrudeParams;
}
