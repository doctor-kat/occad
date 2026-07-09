/**
 * handleRebuild — full parametric rebuild of a project from feature history.
 */

type TopoDS_Shape = any;
import type {
  ExtrudeParams,
  RevolveParams,
  PrimitiveBoxParams,
  FilletParams,
  ChamferParams,
  ShellParams,
  OffsetParams,
  SweepParams,
  LoftParams,
  TransformParams,
  BooleanParams,
  CADProject,
  SketchEdgeData,
  FeatureRefEnrichment,
  SketchRefEnrichment,
  TessellationQuality,
  ImportParams,
} from '@/cad/types';
import { FeatureOperation, compareBuildOrder, isRolledBack, SubShapeKind } from '@/cad/types';
import type { WorkerContext } from '../../workerContext';
import { post, bodyTessellation } from '../../workerContext';
import { getTransferables, findSketchShape, ensureFace } from '../../helpers';
import { buildSketchWire, buildProfileFace } from '../../sketchBuilders';
import { applyFillet } from '../../modifications/fillet';
import { applyChamfer } from '../../modifications/chamfer';
import { applyShell } from '../../modifications/shell';
import { applyOffset } from '../../modifications/offset';
import { enrichRefs } from '../../modifications/shared';
import { applySweep, applyLoft } from '../../advancedModeling';
import { applyTransform } from '../../transforms';
import { tessellate, extractEdgeVertices } from '../../tessellation';
import { reprojectExternalGeometry, enrichSketchExternalRefs } from '../../sketch/externalGeometry';
import { fingerprintAll } from '../../fingerprint';
import { attributeFaceOwners, EMPTY_OWNERSHIP, type FaceOwnership } from '../../faceAttribution';
import { importShapeFromString } from '../../io';
import { buildPrimitiveShape } from '../primitives';
import { performBooleanOperation } from '../boolean';
import { resolveExtrudeDirection } from '../sketch/extrudeSketch';
import { solver, nextShapeId, formatError } from '../shared';

/**
 * Handle full rebuild of project from feature history
 */
export async function handleRebuild(
  ctx: WorkerContext,
  project: CADProject,
  tessellation?: TessellationQuality
): Promise<void> {
  const { oc } = ctx;
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

          let newShape: TopoDS_Shape | null = null;

          if (feature.type === 'extrude-boss' || feature.type === FeatureOperation.EXTRUDED_CUT) {
            const sketchShape = findSketchShape(ctx, feature.sketchId!);
            if (!sketchShape) throw new Error(`Sketch ${feature.sketchId} not found`);
            {
              const faceToExtrude = ensureFace(ctx, sketchShape);
              const params = feature.parameters as ExtrudeParams;
              const direction = resolveExtrudeDirection(ctx, faceToExtrude, params);
              const extrudeVec = new oc.gp_Vec_4(direction.x * params.distance, direction.y * params.distance, direction.z * params.distance);
              const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
              if (prism.IsDone()) newShape = prism.Shape();
              extrudeVec.delete(); prism.delete();
            }
          } else if (feature.type === FeatureOperation.REVOLVED_BOSS || feature.type === FeatureOperation.REVOLVED_CUT) {
            const sketchShape = findSketchShape(ctx, feature.sketchId!);
            if (!sketchShape) throw new Error(`Sketch ${feature.sketchId} not found`);
            {
              const faceToRevolve = ensureFace(ctx, sketchShape);
              const params = feature.parameters as RevolveParams;
              const axisOrigin = new oc.gp_Pnt_3(params.axis.origin.x, params.axis.origin.y, params.axis.origin.z);
              const axisDir = new oc.gp_Dir_4(params.axis.direction.x, params.axis.direction.y, params.axis.direction.z);
              const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);
              const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, (params.angle * Math.PI) / 180, false);
              if (revol.IsDone()) newShape = revol.Shape();
              axisOrigin.delete(); axisDir.delete(); axis.delete(); revol.delete();
            }
          } else if (feature.type === FeatureOperation.IMPORT) {
            // An imported solid has no parametric inputs — its geometry is the
            // file content carried in the feature params, re-parsed each rebuild
            // (worker shape storage is cleared per rebuild). Unions into the body
            // like a primitive.
            const params = feature.parameters as ImportParams;
            newShape = importShapeFromString(ctx, params.format, params.content);
          } else if (
            feature.type === FeatureOperation.BOX ||
            feature.type === FeatureOperation.CYLINDER ||
            feature.type === FeatureOperation.SPHERE ||
            feature.type === FeatureOperation.CONE ||
            feature.type === FeatureOperation.TORUS ||
            feature.type === FeatureOperation.WEDGE
          ) {
            newShape = buildPrimitiveShape(ctx, feature.type, feature.parameters as PrimitiveBoxParams);
          } else if (feature.type === FeatureOperation.SWEEP) {
            const params = feature.parameters as SweepParams;
            const profileShape = findSketchShape(ctx, params.profileSketchId);
            if (!profileShape) throw new Error(`Sweep profile sketch ${params.profileSketchId} not found`);
            const pathShape = findSketchShape(ctx, params.pathSketchId);
            if (!pathShape) throw new Error(`Sweep path sketch ${params.pathSketchId} not found`);
            newShape = applySweep(ctx, profileShape, pathShape);
          } else if (feature.type === FeatureOperation.LOFT) {
            const params = feature.parameters as LoftParams;
            const profileShapes = (params.sketchIds ?? []).map((id) => {
              const s = findSketchShape(ctx, id);
              if (!s) throw new Error(`Loft profile sketch ${id} not found`);
              return s;
            });
            newShape = applyLoft(ctx, profileShapes, params.ruled);
          } else if (
            feature.type === FeatureOperation.FILLET ||
            feature.type === FeatureOperation.CHAMFER ||
            feature.type === FeatureOperation.SHELL ||
            feature.type === FeatureOperation.OFFSET
          ) {
            // Modifications transform the current body in place rather than
            // producing a separate solid to boolean-combine. A modification
            // with no body to act on (none built yet) is a no-op.
            if (currentBody) {
              const body = currentBody;
              // Capture fingerprints against the pre-modification body (where the
              // stored indices are valid), then apply. Push only after the apply
              // succeeds, so a failed modification doesn't enrich. See step 3b.
              switch (feature.type) {
                case FeatureOperation.FILLET: {
                  const p = feature.parameters as FilletParams;
                  const enriched = enrichRefs(ctx, body, p.edges, SubShapeKind.Edge);
                  currentBody = applyFillet(ctx, body, p);
                  if (enriched) refEnrichments.push({ featureId: feature.id, key: 'edges', refs: enriched });
                  break;
                }
                case FeatureOperation.CHAMFER: {
                  const p = feature.parameters as ChamferParams;
                  const enriched = enrichRefs(ctx, body, p.edges, SubShapeKind.Edge);
                  currentBody = applyChamfer(ctx, body, p);
                  if (enriched) refEnrichments.push({ featureId: feature.id, key: 'edges', refs: enriched });
                  break;
                }
                case FeatureOperation.SHELL: {
                  const p = feature.parameters as ShellParams;
                  const enriched = enrichRefs(ctx, body, p.faces, SubShapeKind.Face);
                  currentBody = applyShell(ctx, body, p);
                  if (enriched) refEnrichments.push({ featureId: feature.id, key: 'faces', refs: enriched });
                  break;
                }
                case FeatureOperation.OFFSET: {
                  const p = feature.parameters as OffsetParams;
                  const enriched = enrichRefs(ctx, body, p.faces, SubShapeKind.Face);
                  currentBody = applyOffset(ctx, body, p);
                  if (enriched) refEnrichments.push({ featureId: feature.id, key: 'faces', refs: enriched });
                  break;
                }
              }
            }
          } else if (
            feature.type === FeatureOperation.MOVE ||
            feature.type === FeatureOperation.ROTATE ||
            feature.type === FeatureOperation.MIRROR ||
            feature.type === FeatureOperation.SCALE
          ) {
            // Transforms reposition/resize the current body in place (like
            // modifications, no boolean combine). A transform with no body to
            // act on (none built yet) is a no-op.
            if (currentBody) {
              currentBody = applyTransform(ctx, currentBody, feature.parameters as TransformParams);
            }
          } else if (
            feature.type === FeatureOperation.UNION ||
            feature.type === FeatureOperation.INTERSECT
          ) {
            // A standalone boolean combines specific feature solids (referenced
            // by id) and replaces the current body with the result. Union fuses,
            // Intersect keeps the common volume. Needs at least two operands.
            const params = feature.parameters as BooleanParams;
            const operands = (params.featureIds ?? [])
              .map((id) => featureSolids.get(id))
              .filter((s): s is TopoDS_Shape => !!s && !s.IsNull());
            if (operands.length >= 2) {
              const op = feature.type === FeatureOperation.UNION ? 'union' : 'intersect';
              let combined = operands[0];
              for (let i = 1; i < operands.length; i++) {
                combined = performBooleanOperation(ctx, op, combined, operands[i]);
              }
              currentBody = combined;
            }
          } else if (feature.type === FeatureOperation.MEASURE) {
            // Measurement/analysis features carry no geometry to build — they are
            // pure readouts. Skip them without touching the running body.
          } else {
            // Every body-producing feature type has an explicit branch above.
            // Anything reaching here is an unhandled type (e.g. a newly added
            // FeatureOperation that was never wired into rebuild). Fail loudly
            // instead of silently dropping it from the replayed history.
            throw new Error(`Feature type "${feature.type}" is not wired into parametric rebuild`);
          }

          if (newShape && !newShape.IsNull()) {
            // Capture the isolated solid so later standalone booleans can
            // reference it, before it is auto-combined into the running body.
            featureSolids.set(feature.id, newShape);
            if (currentBody) {
              // Sweep/loft can add or remove material depending on their isCut flag.
              const advancedCut =
                (feature.type === FeatureOperation.SWEEP || feature.type === FeatureOperation.LOFT) &&
                (feature.parameters as SweepParams | LoftParams)?.isCut === true;
              if (feature.type === FeatureOperation.EXTRUDED_CUT || feature.type === FeatureOperation.REVOLVED_CUT || advancedCut) {
                currentBody = performBooleanOperation(ctx, 'subtract', currentBody, newShape);
              } else {
                currentBody = performBooleanOperation(ctx, 'union', currentBody, newShape);
              }
            } else {
              currentBody = newShape;
            }
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
