import type { ImportParams } from '@/cad/types';
import { importShapeFromString } from '../../../io';
import type { FeatureStrategy } from './types';

// An imported solid has no parametric inputs — its geometry is the file
// content carried in the feature params, re-parsed each rebuild (worker
// shape storage is cleared per rebuild). Unions into the body like a primitive.
export const importStrategy: FeatureStrategy = ({ ctx, feature }) => {
  const params = feature.parameters as ImportParams;
  const shape = importShapeFromString(ctx, params.format, params.content);
  return { kind: 'produce', shape, combine: 'union' };
};
