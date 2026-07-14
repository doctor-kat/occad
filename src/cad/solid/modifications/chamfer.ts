type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import type { ChamferParams } from '@/cad/types';
import { SubShapeKind } from '@/cad/types';
import { withSelectorMatches, resolveSubShapes } from './shared';

/**
 * Bevel the selected edges of `shape` with a symmetric distance.
 * OCC: `BRepFilletAPI_MakeChamfer`.
 */
export function applyChamfer(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: ChamferParams
): TopoDS_Shape {
  const { oc } = ctx;
  if (!params.edges?.length && !params.selector) throw new Error('Chamfer requires at least one edge');
  if (!(params.distance > 0)) throw new Error('Chamfer distance must be positive');

  const refs = withSelectorMatches(ctx, shape, params.edges ?? [], SubShapeKind.Edge, params.selector);
  const { shapes: edges, unresolved } = resolveSubShapes(ctx, shape, refs, SubShapeKind.Edge);
  if (unresolved.length > 0) {
    throw new Error(
      `Chamfer: could not resolve edge selection(s) [${unresolved.join(', ')}] — the model topology may have changed since these edges were selected.`
    );
  }
  if (edges.length === 0) throw new Error('Chamfer: none of the selected edges could be resolved');

  const maker = new oc.BRepFilletAPI_MakeChamfer(shape);
  for (const edge of edges) maker.Add_2(params.distance, edge);

  const progress = new oc.Message_ProgressRange_1();
  maker.Build(progress);
  const done = maker.IsDone();
  if (!done) {
    maker.delete();
    progress.delete();
    throw new Error('Chamfer failed (BRepFilletAPI_MakeChamfer not done)');
  }
  const result = maker.Shape();
  maker.delete();
  progress.delete();
  return result;
}
