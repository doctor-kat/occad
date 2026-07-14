/**
 * handleResolveSelector — materialize a selector string into StableRefs.
 */

import type { SubShapeKind, StableRef } from '@/cad/types';
import type { WorkerContext } from '../workerContext';
import { post } from '../workerContext';
import { mapSubShapes, computeFingerprint } from '../fingerprint';
import { describeSubShapes } from '../selectors/describe';
import { selectSubShapes } from '../selectors';
import { formatError } from './shared';

/**
 * Handle resolveSelector request (ROADMAP §9.1, Phase 2): materialize a
 * selector string against a body's sub-shapes and post back fingerprinted
 * `StableRef[]` so the selection survives later topology renumbers.
 */
export function handleResolveSelector(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string,
  kind: SubShapeKind,
  selector: string
): void {
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error(`Shape ${shapeId} not found`);

    const descriptors = describeSubShapes(ctx, shape, kind);
    const matchedIndices = selectSubShapes(descriptors, selector);

    const subShapes = mapSubShapes(ctx, shape, kind);
    const refs: StableRef[] = matchedIndices.map((index) => ({
      kind,
      index,
      fingerprint: computeFingerprint(ctx, subShapes[index], kind, index),
    }));

    post({ type: 'selectorResolved', requestId, refs });
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to resolve selector: ${formatError(err)}`, featureId: `selector-${requestId}` });
  }
}
