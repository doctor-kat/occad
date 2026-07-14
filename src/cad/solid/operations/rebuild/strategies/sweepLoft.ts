import type { SweepParams, LoftParams } from '@/cad/types';
import { findSketchShape } from '../../../helpers';
import { applySweep, applyLoft } from '../../../advancedModeling';
import type { FeatureStrategy } from './types';

export const sweepStrategy: FeatureStrategy = ({ ctx, feature }) => {
  const params = feature.parameters as SweepParams;
  const profileShape = findSketchShape(ctx, params.profileSketchId);
  if (!profileShape) throw new Error(`Sweep profile sketch ${params.profileSketchId} not found`);
  const pathShape = findSketchShape(ctx, params.pathSketchId);
  if (!pathShape) throw new Error(`Sweep path sketch ${params.pathSketchId} not found`);
  const shape = applySweep(ctx, profileShape, pathShape);
  return { kind: 'produce', shape, combine: params.isCut ? 'subtract' : 'union' };
};

export const loftStrategy: FeatureStrategy = ({ ctx, feature }) => {
  const params = feature.parameters as LoftParams;
  const profileShapes = (params.sketchIds ?? []).map((id) => {
    const s = findSketchShape(ctx, id);
    if (!s) throw new Error(`Loft profile sketch ${id} not found`);
    return s;
  });
  const shape = applyLoft(ctx, profileShapes, params.ruled);
  return { kind: 'produce', shape, combine: params.isCut ? 'subtract' : 'union' };
};
