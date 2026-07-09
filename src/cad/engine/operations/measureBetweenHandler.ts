/**
 * handleMeasureBetween — thin wrapper over analysis.measureBetween.
 */

import type { MeasureSelection } from '@/cad/types';
import type { WorkerContext } from '../workerContext';
import { post } from '../workerContext';
import { measureBetween } from '../analysis/measureBetween';
import { formatError } from './shared';

/**
 * Handle measureBetween request (ROADMAP §4): compute the distance (and angle,
 * when both selections are directional and non-parallel) between two picked
 * sub-shapes of a stored body.
 */
export function handleMeasureBetween(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string,
  a: MeasureSelection,
  b: MeasureSelection
): void {
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error('No geometry to measure — build a feature first');
    const measurement = measureBetween(ctx, shape, a, b);
    post({ type: 'measuredBetween', requestId, measurement });
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to measure selection: ${formatError(err)}`, featureId: `measure-${requestId}` });
  }
}
