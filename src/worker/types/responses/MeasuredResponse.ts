import type { MeasurementData } from '@/cad/types';

/** Result of a measureShape request: volume + bounding-box readout. */
export interface MeasuredResponse {
  type: 'measured';
  requestId: string;
  measurement: MeasurementData;
}
