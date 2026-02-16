/**
 * Worker Context and Typed Helpers
 *
 * Shared state and utilities for OpenCascade worker operations.
 */

import type { OpenCascadeInstance, TopoDS_Shape } from 'opencascade.js';
import type { WorkerResponse } from '@/types/cad';

/** Shared worker context passed to all operations */
export interface WorkerContext {
  /** OpenCascade WASM instance */
  oc: OpenCascadeInstance;
  /** Storage for OpenCascade shapes by ID */
  shapeStorage: Map<string, TopoDS_Shape>;
}

/**
 * Type-safe postMessage wrapper
 * @param msg Worker response message
 * @param transfer Optional transferable objects for zero-copy
 */
export function post(msg: WorkerResponse, transfer?: Transferable[]): void {
  self.postMessage(msg, { transfer: transfer ?? [] });
}
