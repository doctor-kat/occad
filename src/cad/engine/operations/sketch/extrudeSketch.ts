/**
 * handleExtrudeSketch and the extrude-direction helpers.
 */

type TopoDS_Shape = any;
import type { ExtrudeParams, Vector3D } from '@/cad/types';
import { ShapeType } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';
import { post, bodyTessellation } from '../../workerContext';
import { getTransferables, findSketchShape, ensureFace } from '../../helpers';
import { tessellate } from '../../tessellation';
import { nextShapeId, formatError } from '../shared';

/**
 * Compute the unit normal of a planar face. Used as the default extrude
 * direction so a sketch on any plane (XY, XZ, YZ, custom/face) extrudes
 * perpendicular to its own plane instead of along a hardcoded world axis.
 * Returns null for non-planar surfaces or on failure.
 */
export function getPlanarFaceNormal(ctx: WorkerContext, face: TopoDS_Shape): Vector3D | null {
  const { oc } = ctx;
  try {
    const f = oc.TopoDS.Face_1(face);
    const surface = oc.BRep_Tool.Surface_2(f);
    const plane = new oc.Handle_Geom_Plane_2(surface.get()).get();
    if (!plane) return null;
    const dir = plane.Axis().Direction();
    return { x: dir.X(), y: dir.Y(), z: dir.Z() };
  } catch {
    return null;
  }
}

/**
 * Resolve the extrude direction for a face: an explicit param direction wins,
 * otherwise fall back to the face's own normal, and only then to world +Z.
 */
export function resolveExtrudeDirection(
  ctx: WorkerContext,
  face: TopoDS_Shape,
  params: ExtrudeParams
): Vector3D {
  return params.direction || getPlanarFaceNormal(ctx, face) || { x: 0, y: 0, z: 1 };
}

/**
 * Handle extrudeSketch request
 */
export function handleExtrudeSketch(
  ctx: WorkerContext,
  featureId: string,
  sketchId: string,
  params: ExtrudeParams
): void {
  const { oc } = ctx;
  try {
    const sketchShape = findSketchShape(ctx, sketchId);
    if (!sketchShape) throw new Error(`Sketch ${sketchId} not found`);
    const faceToExtrude = ensureFace(ctx, sketchShape);
    const direction = resolveExtrudeDirection(ctx, faceToExtrude, params);
    const extrudeVec = new oc.gp_Vec_4(direction.x * params.distance, direction.y * params.distance, direction.z * params.distance);
    const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
    if (!prism.IsDone()) throw new Error('BRepPrimAPI_MakePrism failed');
    const shape = prism.Shape();
    extrudeVec.delete();
    prism.delete();
    const shapeId = `feature_${featureId}_${nextShapeId()}`;
    ctx.shapeStorage.set(shapeId, shape);
    const t = bodyTessellation(ctx);
    const meshData = tessellate(ctx, shape, t.linearDeflection, t.angularDeflection);
    post({ type: 'featureBuilt', featureId, geometry: { shapeId, shapeType: ShapeType.SOLID }, meshData }, getTransferables(meshData));
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to extrude: ${formatError(err)}`, featureId });
  }
}
