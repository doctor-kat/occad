export interface BooleanParams {
  /** IDs of features to combine */
  featureIds: string[];
  /** Operation type */
  operation: 'union' | 'intersect' | 'subtract';
}
