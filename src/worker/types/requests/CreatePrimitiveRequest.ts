import type { FeatureOperation, OperationParams } from '@/cad/types';

/** Create a primitive 3D shape (box, sphere, cylinder, etc.) */
export interface CreatePrimitiveRequest {
    type: 'createPrimitive';
    featureId: string;
    primitiveType: FeatureOperation;
    params: OperationParams;
}
