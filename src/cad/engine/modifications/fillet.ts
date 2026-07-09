type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import type { FilletParams } from '@/cad/types';
import { SubShapeKind } from '@/cad/types';
import { withSelectorMatches, resolveSubShapes } from './shared';

/**
 * Round the selected edges of `shape` with a constant radius.
 * OCC: `BRepFilletAPI_MakeFillet`.
 */
export function applyFillet(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: FilletParams
): TopoDS_Shape {
  const { oc } = ctx;
  if (!params.edges?.length && !params.selector) throw new Error('Fillet requires at least one edge');
  if (!(params.radius > 0)) throw new Error('Fillet radius must be positive');

  const refs = withSelectorMatches(ctx, shape, params.edges ?? [], SubShapeKind.Edge, params.selector);
  const { shapes: edges, unresolved } = resolveSubShapes(ctx, shape, refs, SubShapeKind.Edge);
  if (unresolved.length > 0) {
    throw new Error(
      `Fillet: could not resolve edge selection(s) [${unresolved.join(', ')}] — the model topology may have changed since these edges were selected.`
    );
  }
  if (edges.length === 0) throw new Error('Fillet: none of the selected edges could be resolved');

  const maker = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
  for (const edge of edges) maker.Add_2(params.radius, edge);

  const progress = new oc.Message_ProgressRange_1();
  maker.Build(progress);
  const done = maker.IsDone();
  if (!done) {
    maker.delete();
    progress.delete();
    throw new Error('Fillet failed (BRepFilletAPI_MakeFillet not done)');
  }
  const result = maker.Shape();
  maker.delete();
  progress.delete();
  return result;
}
