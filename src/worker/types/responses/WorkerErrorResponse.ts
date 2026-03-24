import { WorkerResponseType } from '../WorkerResponseType'; // Assuming a common enum for response types

export interface WorkerErrorResponse {
  type: WorkerResponseType.ERROR;
  message: string;
  originalRequestType?: string;
  featureId?: string; // Optional: if error is related to a specific feature
  sketchId?: string;  // Optional: if error is related to a specific sketch
  // Potentially add more detailed error information, stack traces, etc.
}