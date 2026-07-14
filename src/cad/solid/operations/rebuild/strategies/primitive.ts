import type { PrimitiveBoxParams } from '@/cad/types';
import { buildPrimitiveShape } from '../../primitives';
import type { FeatureStrategy } from './types';

export const primitiveStrategy: FeatureStrategy = ({ ctx, feature }) => {
  const shape = buildPrimitiveShape(ctx, feature.type, feature.parameters as PrimitiveBoxParams);
  return { kind: 'produce', shape, combine: 'union' };
};
