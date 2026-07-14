import type { TransformParams } from '@/cad/types';
import { applyTransform } from '../../../transforms';
import type { FeatureStrategy } from './types';

// Transforms reposition/resize the current body in place (like modifications,
// no boolean combine). A transform with no body to act on is a no-op.
export const transformStrategy: FeatureStrategy = ({ ctx, feature, currentBody }) => {
  if (!currentBody) return { kind: 'noop' };
  const body = applyTransform(ctx, currentBody, feature.parameters as TransformParams);
  return { kind: 'replace', body };
};
