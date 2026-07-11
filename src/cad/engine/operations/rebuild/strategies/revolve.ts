type TopoDS_Shape = any;
import type { RevolveParams } from '@/cad/types';
import { FeatureOperation } from '@/cad/types';
import { findSketchShape, ensureFace } from '../../../helpers';
import type { FeatureStrategy } from './types';

export const revolveStrategy: FeatureStrategy = ({ ctx, feature }) => {
  const { oc } = ctx;
  const sketchShape = findSketchShape(ctx, feature.sketchId!);
  if (!sketchShape) throw new Error(`Sketch ${feature.sketchId} not found`);
  const faceToRevolve = ensureFace(ctx, sketchShape);
  const params = feature.parameters as RevolveParams;
  const axisOrigin = new oc.gp_Pnt_3(params.axis.origin.x, params.axis.origin.y, params.axis.origin.z);
  const axisDir = new oc.gp_Dir_4(params.axis.direction.x, params.axis.direction.y, params.axis.direction.z);
  const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);
  const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, (params.angle * Math.PI) / 180, false);
  let shape: TopoDS_Shape | null = null;
  if (revol.IsDone()) shape = revol.Shape();
  axisOrigin.delete(); axisDir.delete(); axis.delete(); revol.delete();
  const combine = feature.type === FeatureOperation.REVOLVED_CUT ? 'subtract' : 'union';
  return { kind: 'produce', shape, combine };
};
