type TopoDS_Shape = any;
import type { ExtrudeParams } from '@/cad/types';
import { FeatureOperation } from '@/cad/types';
import { findSketchShape, ensureFace } from '../../../helpers';
import { resolveExtrudeDirection } from '../../sketch/extrudeSketch';
import type { FeatureStrategy } from './types';

export const extrudeStrategy: FeatureStrategy = ({ ctx, feature }) => {
  const { oc } = ctx;
  const sketchShape = findSketchShape(ctx, feature.sketchId!);
  if (!sketchShape) throw new Error(`Sketch ${feature.sketchId} not found`);
  const faceToExtrude = ensureFace(ctx, sketchShape);
  const params = feature.parameters as ExtrudeParams;
  const direction = resolveExtrudeDirection(ctx, faceToExtrude, params);
  const extrudeVec = new oc.gp_Vec_4(direction.x * params.distance, direction.y * params.distance, direction.z * params.distance);
  const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
  let shape: TopoDS_Shape | null = null;
  if (prism.IsDone()) shape = prism.Shape();
  extrudeVec.delete(); prism.delete();
  const combine = feature.type === FeatureOperation.EXTRUDED_CUT ? 'subtract' : 'union';
  return { kind: 'produce', shape, combine };
};
