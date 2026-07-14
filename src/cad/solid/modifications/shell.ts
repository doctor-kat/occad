type TopoDS_Shape = any;
import type { WorkerContext } from '../workerContext';
import type { ShellParams } from '@/cad/types';
import { SubShapeKind } from '@/cad/types';
import { withSelectorMatches, resolveSubShapes, OFFSET_TOL } from './shared';

/**
 * Hollow out `shape`, removing the selected faces and leaving a wall of the
 * given thickness (negative = inward). OCC: `BRepOffsetAPI_MakeThickSolid`.
 */
export function applyShell(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  params: ShellParams
): TopoDS_Shape {
  const { oc } = ctx;
  if (!params.faces?.length && !params.selector) throw new Error('Shell requires at least one face to remove');
  if (!params.thickness) throw new Error('Shell thickness must be non-zero');

  const refs = withSelectorMatches(ctx, shape, params.faces ?? [], SubShapeKind.Face, params.selector);
  const { shapes: faces, unresolved } = resolveSubShapes(ctx, shape, refs, SubShapeKind.Face);
  if (unresolved.length > 0) {
    throw new Error(
      `Shell: could not resolve face selection(s) [${unresolved.join(', ')}] — the model topology may have changed since these faces were selected.`
    );
  }
  if (faces.length === 0) throw new Error('Shell: none of the selected faces could be resolved');

  const closingFaces = new oc.TopTools_ListOfShape_1();
  for (const face of faces) closingFaces.Append_1(face);

  const maker = new oc.BRepOffsetAPI_MakeThickSolid();
  const progress = new oc.Message_ProgressRange_1();
  maker.MakeThickSolidByJoin(
    shape,
    closingFaces,
    params.thickness,
    OFFSET_TOL,
    oc.BRepOffset_Mode.BRepOffset_Skin,
    false,
    false,
    oc.GeomAbs_JoinType.GeomAbs_Arc,
    false,
    progress
  );
  const done = maker.IsDone();
  if (!done) {
    maker.delete();
    progress.delete();
    closingFaces.delete();
    throw new Error('Shell failed (BRepOffsetAPI_MakeThickSolid not done)');
  }
  const result = maker.Shape();
  maker.delete();
  progress.delete();
  closingFaces.delete();
  return result;
}
