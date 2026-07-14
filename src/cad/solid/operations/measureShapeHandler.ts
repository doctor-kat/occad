/**
 * handleMeasureShape — thin wrapper over analysis.measureShape.
 */

import type { WorkerContext } from '../workerContext';
import { post } from '../workerContext';
import { measureShape } from '../analysis/measureShape';
import { formatError } from './shared';

/**
 * Handle measureShape request (ROADMAP §4): compute a stored body's volume and
 * bounding box and post the readout back to the main thread.
 */
export function handleMeasureShape(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string
): void {
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error('No geometry to measure — build a feature first');
    const measurement = measureShape(ctx, shape);
    post({ type: 'measured', requestId, measurement });
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to measure shape: ${formatError(err)}`, featureId: `measure-${requestId}` });
  }
}
