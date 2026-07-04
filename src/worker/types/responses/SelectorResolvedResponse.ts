import type { StableRef } from '@/cad/types';

/** Result of resolving a selector string to fingerprinted sub-shape refs. */
export interface SelectorResolvedResponse {
  type: 'selectorResolved';
  requestId: string;
  refs: StableRef[];
}
