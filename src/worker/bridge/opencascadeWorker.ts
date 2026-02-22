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
  formatError, // Import formatError from operations
} from '@/cad/engine/operations';
import { SketchSolver } from '@/cad/engine/SketchSolver'; // New import
import { buildSketchWire } from '@/cad/engine/sketchBuilders'; // New import
import { tessellate } from '@/cad/engine/tessellation'; // New import
import { getTransferables } from '@/cad/engine/helpers'; // New import
import type { SketchUpdateRequest } from '@/worker/types/requests/SketchUpdateRequest'; // New import
import type { SketchSolvedResponse } from '@/worker/types/responses/SketchSolvedResponse'; // New import
import type { SketchPoint } from '@/cad/types/sketch/SketchPoint'; // New import
import type { Sketch } from '@/cad/types/sketch/Sketch'; // New import

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

// Add handleSketchUpdateRequest function
async function handleSketchUpdateRequest(ctx: WorkerContext, message: SketchUpdateRequest): Promise<void> {
  const { oc } = ctx;
  const { sketch } = message;

  post({ type: 'progress', message: `Solving and updating sketch ${sketch.id}...` });

  try {
    // 1. Solve the sketch using the SketchSolver
    const solver = new SketchSolver(sketch);
    const solvedSketch = solver.solve();

    // Create a map of solved points for efficient lookup in buildSketchWire
    const solvedPointsMap = new Map<string, SketchPoint>(
      solvedSketch.points.map((p) => [p.id, p])
    );

    // 2. Build OpenCascade wire from solved sketch elements and points
    const wire = buildSketchWire(ctx, solvedSketch.elements, solvedSketch.plane, solvedPointsMap);

    // 3. Create face from wire (if closed)
    let shape: TopoDS_Shape = wire;
    try {
      if (solvedSketch.isClosed) { // Only try to make a face if the sketch is marked as closed
        const wireWire = oc.TopoDS.Wire_1(wire);
        const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wireWire, false);

        if (faceMaker.IsDone()) {
          shape = faceMaker.Face();
        } else {
          console.warn('Could not create face from wire in SketchUpdateRequest, using wire only');
        }
        faceMaker.delete();
      }
    } catch (err) {
      console.warn('Failed to create face from wire in SketchUpdateRequest:', err);
    }

    // 4. Store shape and tessellate for visualization
    const shapeId = `sketch_solved_${solvedSketch.id}_${Date.now()}`; // Unique ID for the solved shape
    ctx.shapeStorage.set(shapeId, shape);

    const meshData = tessellate(ctx, shape, 0.05, 0.3); // Use appropriate tessellation params

    // 5. Send response back to main thread
    const response: SketchSolvedResponse = {
      type: 'sketchSolved',
      solvedSketch: solvedSketch,
      meshData: meshData,
    };

    post(response, getTransferables(meshData));
  } catch (err: unknown) {
    const message = formatError(err); // Assuming formatError is accessible
    post({
      type: 'error',
      message: `Failed to solve and update sketch: ${message}`,
      featureId: sketch.id,
    });
  }
}


