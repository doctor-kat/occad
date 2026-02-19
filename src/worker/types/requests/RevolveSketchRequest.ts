import type { RevolveParams } from '@/cad/types';

/** Revolve a sketch around an axis to create a 3D feature */
export interface RevolveSketchRequest {
    type: 'revolveSketch';
    featureId: string;
    sketchId: string;
    params: RevolveParams;
}
