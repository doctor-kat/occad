/**
 * OpenCascade.js Web Worker
 *
 * Loads the OpenCascade WASM module, builds parametric CAD models using the
 * raw OpenCascade API, tessellates them, and sends mesh + edge data back to
 * the main thread via transferable ArrayBuffers.
 *
 * Supports parametric feature history with sketches, extrude, revolve, and boolean operations.
 */

import type { OpenCascadeInstance, TopoDS_Shape } from 'opencascade.js';
import type { WorkerRequest } from '@/worker/types';
import type { WorkerContext } from '@/cad/engine/workerContext';
import { post } from '@/cad/engine/workerContext';
import {
  handleBuildSketch,
  handleExtrudeSketch,
  handleRevolveSketch,
  handleRebuild,
  handleGetFaceGeometry,
} from '@/cad/engine/operations';

// ---------------------------------------------------------------------------
// Worker State
// ---------------------------------------------------------------------------

let oc: OpenCascadeInstance | null = null;

/** Storage for OpenCascade shapes by ID */
const shapeStorage = new Map<string, TopoDS_Shape>();

// ---------------------------------------------------------------------------
// Initialise the OpenCascade WASM module
// ---------------------------------------------------------------------------
async function init(): Promise<void> {
  post({ type: 'progress', message: 'Loading OpenCascade WASM…' });

  try {
    const module = await import('opencascade.js');
    const initOpenCascade = module.default;

    if (!initOpenCascade) {
      throw new Error('initOpenCascade is undefined - module.default is missing');
    }

    oc = await initOpenCascade();
    post({ type: 'ready' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', message: `Failed to init OpenCascade: ${message}` });
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
self.onmessage = async (e: MessageEvent) => {
  const message = e.data as WorkerRequest;

  try {
    // Check if OpenCascade is initialized (except for init message)
    if (message.type !== 'init' && !oc) {
      post({ type: 'error', message: 'OpenCascade not initialized' });
      return;
    }

    // Create worker context (only when oc is initialized)
    const ctx: WorkerContext = {
      oc: oc!,
      shapeStorage,
    };

    switch (message.type) {
      case 'init':
        await init();
        break;

      case 'buildSketch':
        handleBuildSketch(ctx, message.sketchId, message.plane, message.elements);
        break;

      case 'extrudeSketch':
        handleExtrudeSketch(ctx, message.featureId, message.sketchId, message.params);
        break;

      case 'revolveSketch':
        handleRevolveSketch(ctx, message.featureId, message.sketchId, message.params);
        break;

      case 'deleteShape':
        shapeStorage.delete(message.shapeId);
        break;

      case 'rebuild':
        handleRebuild(ctx, message.project);
        break;

      case 'getFaceGeometry':
        handleGetFaceGeometry(ctx, message.faceId, message.shapeId);
        break;

      default:
        post({
          type: 'error',
          message: `Unknown message type: ${(message as { type: string }).type}`,
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({
      type: 'error',
      message,
    });
  }
};

// Auto-init on worker creation
init();
