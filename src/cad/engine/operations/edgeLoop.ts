/**
 * handleGetEdgeLoop — resolve the wire loop containing a picked edge.
 */

import type { WorkerContext } from '../workerContext';
import { post } from '../workerContext';
import { pickLoop } from '../edgeLoop';
import { formatError } from './shared';

/**
 * Handle getEdgeLoop request ("Select Loop"): return the edges of the wire that
 * contains the picked edge, in the same 0-based global-edge index scheme the
 * mesh's `edgeMapping` uses. Walks the body's wires, maps each wire's edges to
 * global indices, and delegates the selection to the pure `pickLoop`.
 */
export function handleGetEdgeLoop(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string,
  edgeIndex: number
): void {
  const { oc } = ctx;
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error(`Shape ${shapeId} not found`);

    // Global edge map — the index scheme edgeMapping/selections use (0-based).
    const globalEdgeMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, globalEdgeMap);

    // Each wire as a list of its global edge indices.
    const wireMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_WIRE, wireMap);
    const wires: number[][] = [];
    for (let w = 1; w <= wireMap.Extent(); w++) {
      const wire = wireMap.FindKey(w);
      const wireEdges = new oc.TopTools_IndexedMapOfShape_1();
      oc.TopExp.MapShapes_1(wire, oc.TopAbs_ShapeEnum.TopAbs_EDGE, wireEdges);
      const indices: number[] = [];
      for (let e = 1; e <= wireEdges.Extent(); e++) {
        const gi = globalEdgeMap.FindIndex(wireEdges.FindKey(e));
        if (gi > 0) indices.push(gi - 1);
      }
      wireEdges.delete();
      wires.push(indices);
    }

    const edgeIndices = pickLoop(wires, edgeIndex);

    wireMap.delete();
    globalEdgeMap.delete();
    post({ type: 'edgeLoop', requestId, edgeIndices });
  } catch (err: unknown) {
    // Scoped like face-pick so a missed loop query can't escalate to the fatal
    // app-wide error overlay.
    post({ type: 'error', message: `Failed to select loop: ${formatError(err)}`, featureId: `edge-loop-${requestId}` });
  }
}
