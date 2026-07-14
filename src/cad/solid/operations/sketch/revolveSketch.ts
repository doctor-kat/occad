/**
 * handleRevolveSketch — revolve a sketch profile around an axis.
 */

import type { RevolveParams } from '@/cad/types';
import { ShapeType } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';
import { post, bodyTessellation } from '../../workerContext';
import { getTransferables, findSketchShape, ensureFace } from '../../helpers';
import { tessellate } from '../../tessellation';
import { nextShapeId, formatError } from '../shared';

/**
 * Handle revolveSketch request
 */
export function handleRevolveSketch(
  ctx: WorkerContext,
  featureId: string,
  sketchId: string,
  params: RevolveParams
): void {
  const { oc } = ctx;
  try {
    const sketchShape = findSketchShape(ctx, sketchId);
    if (!sketchShape) throw new Error(`Sketch ${sketchId} not found`);
    const faceToRevolve = ensureFace(ctx, sketchShape);
    const axisOrigin = new oc.gp_Pnt_3(params.axis.origin.x, params.axis.origin.y, params.axis.origin.z);
    const axisDir = new oc.gp_Dir_4(params.axis.direction.x, params.axis.direction.y, params.axis.direction.z);
    const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);
    const angleRad = (params.angle * Math.PI) / 180;
    const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, angleRad, false);
    if (!revol.IsDone()) throw new Error('BRepPrimAPI_MakeRevol failed');
    const shape = revol.Shape();
    axisOrigin.delete(); axisDir.delete(); axis.delete(); revol.delete();
    const shapeId = `feature_${featureId}_${nextShapeId()}`;
    ctx.shapeStorage.set(shapeId, shape);
    const t = bodyTessellation(ctx);
    const meshData = tessellate(ctx, shape, t.linearDeflection, t.angularDeflection);
    post({ type: 'featureBuilt', featureId, geometry: { shapeId, shapeType: ShapeType.SOLID }, meshData }, getTransferables(meshData));
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to revolve: ${formatError(err)}`, featureId });
  }
}
