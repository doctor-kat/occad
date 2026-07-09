/**
 * Boolean operation dispatcher.
 */

type TopoDS_Shape = any;
import type { WorkerContext } from '../../workerContext';
import { performUnion } from './union';
import { performSubtract } from './subtract';
import { performIntersect } from './intersect';

/**
 * Perform boolean operation on shapes
 */
export function performBooleanOperation(
  ctx: WorkerContext,
  operation: 'union' | 'intersect' | 'subtract',
  shape1: TopoDS_Shape,
  shape2: TopoDS_Shape
): TopoDS_Shape {
  switch (operation) {
    case 'union':
      return performUnion(ctx, shape1, shape2);
    case 'subtract':
      return performSubtract(ctx, shape1, shape2);
    case 'intersect':
      return performIntersect(ctx, shape1, shape2);
  }
  return shape1;
}
