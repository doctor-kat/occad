import type { MeasureBetweenData } from '@/cad/types';

/** Result of a measureBetween request: distance + optional angle readout. */
export interface MeasuredBetweenResponse {
  type: 'measuredBetween';
  requestId: string;
  measurement: MeasureBetweenData;
}
