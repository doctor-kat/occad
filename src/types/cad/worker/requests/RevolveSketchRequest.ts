import type { RevolveParams } from '../../operation-params';

/** Revolve a sketch around an axis to create a 3D feature */
export interface RevolveSketchRequest {
    type: 'revolveSketch';
    featureId: string;
    sketchId: string;
    params: RevolveParams;
}
