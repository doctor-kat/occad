import type { FeatureStrategy } from './types';

// Measurement/analysis features carry no geometry to build — they are pure
// readouts. Skip them without touching the running body.
export const measureStrategy: FeatureStrategy = () => ({ kind: 'noop' });
