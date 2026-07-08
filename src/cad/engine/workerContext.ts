/**
 * Worker Context and Typed Helpers
 *
 * Shared state and utilities for OpenCascade worker operations.
 */

import type { OpenCascadeInstance, TopoDS_Shape } from 'opencascade.js';
import type { WorkerResponse } from '@/worker/types';
import type { TessellationQuality } from '@/cad/types';
import { resolveTessellationQuality } from '@/cad/types';

/** Shared worker context passed to all operations */
export interface WorkerContext {
  /** OpenCascade WASM instance */
  oc: OpenCascadeInstance;
  /** Storage for OpenCascade shapes by ID */
  shapeStorage: Map<string, TopoDS_Shape>;
  /**
   * Mesh resolution for solid bodies. Set from the rebuild request's
   * tessellation setting; falls back to the Standard preset when unset so
   * every operation that meshes a body picks up the user's choice.
   */
  tessellation?: TessellationQuality;
}

/** Read the effective solid-body tessellation quality from the context. */
export function bodyTessellation(ctx: WorkerContext): TessellationQuality {
  return ctx.tessellation ?? resolveTessellationQuality();
}

/**
 * Type-safe postMessage wrapper
 * @param msg Worker response message
 * @param transfer Optional transferable objects for zero-copy
 */
export function post(msg: WorkerResponse, transfer?: Transferable[]): void {
  self.postMessage(msg, { transfer: transfer ?? [] });
}
