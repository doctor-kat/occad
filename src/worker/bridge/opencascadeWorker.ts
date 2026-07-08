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
import { SketchSolver } from '@/cad/engine/SketchSolver';
import {
  handleBuildSketch,
  handleExtrudeSketch,
  handleRevolveSketch,
  handleRebuild,
  handleGetFaceGeometry,
  handleGetEdgeLoop,
  handleResolveSelector,
  handleExportShape,
  handleMeasureShape,
  handleMeasureBetween,
} from '@/cad/engine/operations';

const openCascadeWasm = '/opencascade.full.wasm';

// ---------------------------------------------------------------------------
// Worker State
// ---------------------------------------------------------------------------

let oc: OpenCascadeInstance | null = null;

/** Storage for OpenCascade shapes by ID */
const shapeStorage = new Map<string, TopoDS_Shape>();

// ---------------------------------------------------------------------------
// Initialise the OpenCascade WASM module and Sketch solver
// ---------------------------------------------------------------------------
async function init(): Promise<void> {
  post({ type: 'progress', message: 'Loading OpenCascade WASM…' });

  try {
    const module = await import('opencascade.js');
    const initOpenCascade = module.default;

    if (!initOpenCascade) {
      throw new Error('initOpenCascade is undefined - module.default is missing');
    }

    oc = await initOpenCascade({
      mainWasm: openCascadeWasm,
    });
    
    // Initialize the sketch solver (planegcs)
    post({ type: 'progress', message: 'Loading Sketch Solver…' });
    await SketchSolver.init();

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
        await handleBuildSketch(ctx, message.sketch, message.bodyId);
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
        await handleRebuild(ctx, message.project, message.tessellation);
        break;

      case 'getFaceGeometry':
        handleGetFaceGeometry(ctx, message.faceId, message.shapeId);
        break;

      case 'getEdgeLoop':
        handleGetEdgeLoop(ctx, message.requestId, message.shapeId, message.edgeIndex);
        break;

      case 'resolveSelector':
        handleResolveSelector(ctx, message.requestId, message.shapeId, message.kind, message.selector);
        break;

      case 'exportShape':
        handleExportShape(ctx, message.requestId, message.shapeId, message.format);
        break;

      case 'measureShape':
        handleMeasureShape(ctx, message.requestId, message.shapeId);
        break;

      case 'measureBetween':
        handleMeasureBetween(ctx, message.requestId, message.shapeId, message.a, message.b);
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


