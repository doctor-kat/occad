import type { MeasureType } from './MeasureType';

export interface MeasureParams {
  type: MeasureType;
  /** Entity IDs to measure (faces, edges, vertices) */
  entities: string[];
}
