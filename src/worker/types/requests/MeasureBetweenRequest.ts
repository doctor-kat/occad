import type { MeasureSelection } from '@/cad/types';

/**
 * Compute the distance (and angle, when applicable) between two picked
 * sub-shapes of a stored body (ROADMAP §4 Measure distance/length).
 */
export interface MeasureBetweenRequest {
  type: 'measureBetween';
  requestId: string;
  shapeId: string;
  a: MeasureSelection;
  b: MeasureSelection;
}
