import type { FeatureTool } from '../../tools';
import type { OperationParams } from '../../operation-params';

/** Create a primitive 3D shape (box, sphere, cylinder, etc.) */
export interface CreatePrimitiveRequest {
    type: 'createPrimitive';
    featureId: string;
    primitiveType: FeatureTool;
    params: OperationParams;
}
