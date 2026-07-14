/**
 * handleRebuild — full parametric rebuild of a project from feature history.
 */

type TopoDS_Shape = any;
import type {
  CADProject,
  SketchEdgeData,
  FeatureRefEnrichment,
  SketchRefEnrichment,
  TessellationQuality,
} from '@/cad/types';
import { compareBuildOrder, isRolledBack, SubShapeKind } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';
import { post, bodyTessellation } from '../../workerContext';
import { getTransferables } from '../../helpers';
import { buildSketchWire, buildProfileFace } from '../../sketchBuilders';
import { performBooleanOperation } from '../boolean';
import { tessellate, extractEdgeVertices } from '../../tessellation';
import { reprojectExternalGeometry, enrichSketchExternalRefs } from '../../sketch/externalGeometry';
import { fingerprintAll } from '../../fingerprint';
import { attributeFaceOwners, EMPTY_OWNERSHIP, type FaceOwnership } from '../../faceAttribution';
import { solver, nextShapeId, formatError } from '../shared';
import { FEATURE_STRATEGY_REGISTRY } from './strategies/registry';

/**
 * Handle full rebuild of project from feature history
 */
export async function handleRebuild(
  ctx: WorkerContext,
  project: CADProject,
  tessellation?: TessellationQuality
): Promise<void> {
  // Carry the requested mesh resolution for the whole rebuild so every
  // body-tessellating step (features + final body) uses it.
  ctx.tessellation = tessellation ?? ctx.tessellation;

  try {
    post({ type: 'progress', message: 'Starting full rebuild...' });
    // Release the previous rebuild's WASM-side shapes before dropping the JS
    // references, or their embind heap allocations are never reclaimed (a
    // session-long memory leak, since rebuild fires on every project edit).
    // De-dupe by object identity first: the same shape is often stored under
    // multiple keys (e.g. a feature's shape and 'CURRENT_REBUILD_SHAPE').
    for (const shape of new Set(ctx.shapeStorage.values())) {
      try { (shape as { delete?: () => void }).delete?.(); } catch { /* already released */ }
    }
    ctx.shapeStorage.clear();

    let currentBody: TopoDS_Shape | null = null;
    // Each feature's isolated solid (captured before the implicit boss/cut
    // auto-union), keyed by feature id. Standalone Union/Intersect features
    // reference these by id to combine specific solids on demand.
    const featureSolids = new Map<string, TopoDS_Shape>();
    const sketchEdgesMap: Record<string, SketchEdgeData> = {};
    // Lazily-captured fingerprint upgrades for modification selections (step 3b).
    const refEnrichments: FeatureRefEnrichment[] = [];
    // Lazily-captured fingerprint upgrades for sketch external-geometry refs (step 3c).
    const sketchRefEnrichments: SketchRefEnrichment[] = [];
    // Per-face → owning-feature attribution, carried forward across each feature
    // step so the final body's faces can be traced back to the feature that made
    // them (context menu Edit Feature/Sketch, face-accurate Suppress/Delete).
    let faceOwnership: FaceOwnership = EMPTY_OWNERSHIP;

    // Deterministic, total build order shared with the feature tree: order by
    // `sequence ?? createdAt`, tie-broken by id. See compareBuildOrder.
    const items = [
      ...project.sketches.map(s => ({ type: 'sketch' as const, data: s })),
      ...project.features.map(f => ({ type: 'feature' as const, data: f }))
    ].sort((a, b) => compareBuildOrder(a.data, b.data));

    const totalItems = items.length;
    let processedItems = 0;

    for (const item of items) {
      const itemId = item.data.id;
      try {
        post({ type: 'rebuildProgress', progress: processedItems / totalItems, currentFeatureId: itemId });

        // History rollback bar: items past the bar are skipped (like suppression,
        // but via the bar so the distinction is preserved). See ROADMAP.md §8.
        if (isRolledBack(item.data, project.rollbackBar)) { processedItems++; continue; }

        if (item.type === 'sketch') {
          const sketch = item.data;
          const hasEdges = sketch.primitives.some(p => !p.isExternal && p.type !== 'point');
          if (!hasEdges) {
            processedItems++;
            continue;
          }
          // Capture geometry-anchored upgrades for external refs against the
          // body where the positional indices are still valid (step 3c), then
          // reproject. Persistence (no version bump) converges after one rebuild.
          if (currentBody) {
            const caps = enrichSketchExternalRefs(ctx, sketch, currentBody);
            if (caps.length) sketchRefEnrichments.push(...caps);
          }
          const sketchToSolve = currentBody ? reprojectExternalGeometry(ctx, sketch, currentBody) : sketch;
          const solvedSketch = await solver.solve(sketchToSolve);
          try {
            const wire = buildSketchWire(ctx, solvedSketch);
            const shape: TopoDS_Shape = buildProfileFace(ctx, wire);
            const shapeId = `sketch_${sketch.id}_${nextShapeId()}`;
            ctx.shapeStorage.set(shapeId, shape);
            const edgeVertices = extractEdgeVertices(ctx, shape, 0.05, 0.3);
            if (edgeVertices.length > 0) sketchEdgesMap[sketch.id] = { edgeVertices };
          } catch (err) {
            console.warn(`[rebuild] sketch geometry build failed for ${sketch.id}:`, err);
          }
        } else if (item.type === 'feature') {
          const feature = item.data;
          if (feature.isSuppressed) { processedItems++; continue; }

          // Every body-affecting feature type has an explicit strategy in the
          // registry. Anything missing (e.g. a newly added FeatureOperation
          // that was never wired in) fails loudly instead of silently
          // dropping it from the replayed history.
          const strategy = FEATURE_STRATEGY_REGISTRY[feature.type];
          if (!strategy) throw new Error(`Feature type "${feature.type}" is not wired into parametric rebuild`);

          const result = strategy({ ctx, feature, currentBody, featureSolids, refEnrichments });

          if (result.kind === 'produce') {
            const newShape = result.shape;
            if (newShape && !newShape.IsNull()) {
              // Capture the isolated solid so later standalone booleans can
              // reference it, before it is auto-combined into the running body.
              featureSolids.set(feature.id, newShape);
              currentBody = currentBody
                ? performBooleanOperation(ctx, result.combine, currentBody, newShape)
                : newShape;
            }
          } else if (result.kind === 'replace') {
            currentBody = result.body;
          }
          if (currentBody) ctx.shapeStorage.set(`feature_${feature.id}_${nextShapeId()}`, currentBody);
          // Roll face ownership forward: faces surviving this feature keep their
          // owner; faces it newly introduced are attributed to it. A feature that
          // didn't touch the body (e.g. MEASURE, a no-op transform) leaves every
          // fingerprint matching, so ownership is unchanged.
          if (currentBody) {
            faceOwnership = attributeFaceOwners(
              faceOwnership,
              fingerprintAll(ctx, currentBody, SubShapeKind.Face),
              feature.id,
            );
          }
        }
        processedItems++;
      } catch (err: unknown) {
        // Surface the failure on the offending tree item instead of swallowing
        // it. A featured error keeps the rebuild going (the body so far is still
        // shown) but flags the item so a stale selection can't silently no-op.
        const message = formatError(err);
        console.error(`Failed to rebuild item ${itemId}:`, err);
        post({ type: 'error', message: `${item.data.name ?? itemId}: ${message}`, featureId: itemId });
      }
    }

    if (currentBody) {
      const finalShapeId = 'CURRENT_REBUILD_SHAPE';
      ctx.shapeStorage.set(finalShapeId, currentBody);
      const t = bodyTessellation(ctx);
      const meshData = tessellate(ctx, currentBody, t.linearDeflection, t.angularDeflection);
      // Attach face→feature attribution (indexed by the same CAD face id
      // `faceMapping` reports). A plain array — structured-cloned, not transferred.
      meshData.faceOwners = faceOwnership.owners;
      const transferables: Transferable[] = [...getTransferables(meshData)];
      for (const edge of Object.values(sketchEdgesMap)) transferables.push(edge.edgeVertices.buffer);
      post({ type: 'rebuildComplete', meshData, shapeId: finalShapeId, sketchEdges: sketchEdgesMap, refEnrichments: refEnrichments.length ? refEnrichments : undefined, sketchRefEnrichments: sketchRefEnrichments.length ? sketchRefEnrichments : undefined }, transferables);
    } else {
      post({ type: 'rebuildComplete', meshData: { faceVertices: new Float32Array(0), faceNormals: new Float32Array(0), faceIndices: new Uint32Array(0), edgeVertices: new Float32Array(0), edgeIndices: new Uint32Array(0), faceMapping: new Uint32Array(0), edgeCount: 0 }, shapeId: '', sketchEdges: sketchEdgesMap });
    }
  } catch (err: unknown) {
    post({ type: 'error', message: `Rebuild failed: ${formatError(err)}` });
  }
}
