/**
 * handleBuildSketch — solve a sketch's constraints and build its wire/face.
 */

type TopoDS_Shape = any;
import type { Sketch, MeshData, ShapeReference } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';
import { post } from '../../workerContext';
import { getTransferables } from '../../helpers';
import { buildSketchWire, buildProfileFace } from '../../sketchBuilders';
import { tessellate } from '../../tessellation';
import { reprojectExternalGeometry } from '../../sketch/externalGeometry';
import { solver, nextShapeId, formatError } from '../shared';

/**
 * Handle buildSketch request
 */
export async function handleBuildSketch(
  ctx: WorkerContext,
  sketch: Sketch,
  bodyId?: string
): Promise<void> {
  try {
    post({ type: 'progress', message: `Solving sketch ${sketch.id}...` });

    // 1. Re-project external geometry if a body is provided
    let sketchToSolve = sketch;
    if (bodyId) {
      const body = ctx.shapeStorage.get(bodyId);
      if (body) {
        sketchToSolve = reprojectExternalGeometry(ctx, sketch, body);
      }
    }

    // 2. Solve the sketch constraints
    const solvedSketch = await solver.solve(sketchToSolve);

    post({ type: 'progress', message: `Building sketch geometry ${sketch.id}...` });

    // 3-6. Build geometry (wire → face(s) → mesh). This is best-effort: a profile
    // that can't be faced (e.g. an open/degenerate loop) must NOT prevent the solved
    // sketch — and therefore its constraints — from being posted back to the UI.
    let geometry: ShapeReference | undefined;
    let meshData: MeshData | undefined;
    try {
      const wire = buildSketchWire(ctx, solvedSketch);
      const shape: TopoDS_Shape = buildProfileFace(ctx, wire);
      const shapeId = `sketch_${sketch.id}_${nextShapeId()}`;
      ctx.shapeStorage.set(shapeId, shape);
      geometry = { shapeId, shapeType: 'face' as const };
      meshData = tessellate(ctx, shape, 0.05, 0.3);
    } catch (err) {
      console.warn(`[handleBuildSketch] geometry build failed for ${sketch.id}; constraints still applied:`, err);
    }

    post(
      {
        type: 'sketchBuilt',
        sketchId: sketch.id,
        geometry,
        meshData,
        solvedSketch,
      },
      meshData ? getTransferables(meshData) : []
    );
  } catch (err: unknown) {
    const message = formatError(err);
    post({
      type: 'error',
      message: `Failed to build sketch: ${message}`,
      featureId: sketch.id,
    });
  }
}
