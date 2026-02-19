import type { BooleanParams } from '@/cad/types';
import type { ShapeReference } from '@/cad/types';

/** Perform boolean operation (union, subtract, intersect) on shapes */
export interface BooleanOperationRequest {
    type: 'booleanOperation';
    featureId: string;
    params: BooleanParams;
    shapes: ShapeReference[];
}
