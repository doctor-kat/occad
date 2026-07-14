type TopoDS_Shape = any;
import { FeatureOperation, type BooleanParams } from '@/cad/types';
import { performBooleanOperation } from '../../boolean';
import type { FeatureStrategy } from './types';

// A standalone boolean combines specific feature solids (referenced by id)
// and replaces the current body with the result. Union fuses, Intersect
// keeps the common volume. Needs at least two operands.
export const booleanStrategy: FeatureStrategy = ({ ctx, feature, featureSolids }) => {
  const params = feature.parameters as BooleanParams;
  const operands = (params.featureIds ?? [])
    .map((id) => featureSolids.get(id))
    .filter((s): s is TopoDS_Shape => !!s && !s.IsNull());
  if (operands.length < 2) return { kind: 'noop' };
  const op = feature.type === FeatureOperation.UNION ? 'union' : 'intersect';
  let combined = operands[0];
  for (let i = 1; i < operands.length; i++) {
    combined = performBooleanOperation(ctx, op, combined, operands[i]);
  }
  return { kind: 'replace', body: combined };
};
