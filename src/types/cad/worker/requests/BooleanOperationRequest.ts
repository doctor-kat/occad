import type { BooleanParams } from '../../operation-params';
import type { ShapeReference } from '../../geometry';

/** Perform boolean operation (union, subtract, intersect) on shapes */
export interface BooleanOperationRequest {
    type: 'booleanOperation';
    featureId: string;
    params: BooleanParams;
    shapes: ShapeReference[];
}
