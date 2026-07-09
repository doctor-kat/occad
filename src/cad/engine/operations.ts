/**
 * CAD Operation Handlers
 *
 * Handlers for sketch building, extrusion, revolution, rebuild, and other operations.
 */

type TopoDS_Shape = any;
import type {
  Sketch,
  SketchPrimitive,
  ExtrudeParams,
  RevolveParams,
  PrimitiveBoxParams,
  PrimitiveCylinderParams,
  PrimitiveSphereParams,
  PrimitiveConeParams,
  PrimitiveTorusParams,
  PrimitiveWedgeParams,
  FilletParams,
  ChamferParams,
  ShellParams,
  OffsetParams,
  SweepParams,
  LoftParams,
  TransformParams,
  BooleanParams,
  MeasureParams,
  CADProject,
  MeshData,
  SketchEdgeData,
  Point3D,
  Vector3D,
  FeatureRefEnrichment,
  SketchRefEnrichment,
  StableRef,
  MeasureSelection,
  TessellationQuality,
} from '@/cad/types';
import { ShapeType, FeatureOperation, TransformOperation, PlaneType, compareBuildOrder, isRolledBack, SubShapeKind } from '@/cad/types';
import type { WorkerContext } from './workerContext';
import { post, bodyTessellation } from './workerContext';
import { getTransferables, findSketchShape, ensureFace } from './helpers';
import { buildSketchWire, buildProfileFace } from './sketchBuilders';
import { applyFillet, applyChamfer, applyShell, applyOffset, enrichRefs } from './modifications';
import { applySweep, applyLoft } from './advancedModeling';
import { applyTransform } from './transforms';
import { tessellate, extractEdgeVertices } from './tessellation';
import { SketchSolver } from './SketchSolver';
import { reprojectExternalGeometry, enrichSketchExternalRefs } from './sketch/externalGeometry';
import { mapSubShapes, computeFingerprint, fingerprintAll } from './fingerprint';
import { attributeFaceOwners, EMPTY_OWNERSHIP, type FaceOwnership } from './faceAttribution';
import { pickLoop } from './edgeLoop';
import { describeSubShapes } from './selectors/describe';
import { selectSubShapes } from './selectors';
import { exportShapeToString, importShapeFromString } from './io';
import { measureShape, measureBetween } from './analysis';
import type { ImportParams, ExportFormat } from '@/cad/types';

/** Counter for generating unique shape IDs */
let shapeIdCounter = 0;
const solver = new SketchSolver();

/**
 * Format error object for display
 * OpenCascade C++ exceptions don't have proper message properties
 */
function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const errObj = err as any;
    if (typeof errObj === 'number') return `OpenCascade error (code: ${errObj})`;
    if (typeof errObj.message === 'string') return errObj.message;
    if (typeof errObj.toString === 'function') {
      const str = errObj.toString();
      if (str !== '[object Object]' && !/^\d+$/.test(str)) return str;
    }
  }
  return String(err);
}

/**
 * Compute the unit normal of a planar face. Used as the default extrude
 * direction so a sketch on any plane (XY, XZ, YZ, custom/face) extrudes
 * perpendicular to its own plane instead of along a hardcoded world axis.
 * Returns null for non-planar surfaces or on failure.
 */
export function getPlanarFaceNormal(ctx: WorkerContext, face: TopoDS_Shape): Vector3D | null {
  const { oc } = ctx;
  try {
    const f = oc.TopoDS.Face_1(face);
    const surface = oc.BRep_Tool.Surface_2(f);
    const plane = new oc.Handle_Geom_Plane_2(surface.get()).get();
    if (!plane) return null;
    const dir = plane.Axis().Direction();
    return { x: dir.X(), y: dir.Y(), z: dir.Z() };
  } catch {
    return null;
  }
}

/**
 * Resolve the extrude direction for a face: an explicit param direction wins,
 * otherwise fall back to the face's own normal, and only then to world +Z.
 */
export function resolveExtrudeDirection(
  ctx: WorkerContext,
  face: TopoDS_Shape,
  params: ExtrudeParams
): Vector3D {
  return params.direction || getPlanarFaceNormal(ctx, face) || { x: 0, y: 0, z: 1 };
}

/**
 * Handle buildSketch request
 */
export async function handleBuildSketch(
  ctx: WorkerContext,
  sketch: Sketch,
  bodyId?: string
): Promise<void> {
  const { oc } = ctx;

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
      const shapeId = `sketch_${sketch.id}_${shapeIdCounter++}`;
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

/**
 * Handle extrudeSketch request
 */
export function handleExtrudeSketch(
  ctx: WorkerContext,
  featureId: string,
  sketchId: string,
  params: ExtrudeParams
): void {
  const { oc } = ctx;
  try {
    const sketchShape = findSketchShape(ctx, sketchId);
    if (!sketchShape) throw new Error(`Sketch ${sketchId} not found`);
    const faceToExtrude = ensureFace(ctx, sketchShape);
    const direction = resolveExtrudeDirection(ctx, faceToExtrude, params);
    const extrudeVec = new oc.gp_Vec_4(direction.x * params.distance, direction.y * params.distance, direction.z * params.distance);
    const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
    if (!prism.IsDone()) throw new Error('BRepPrimAPI_MakePrism failed');
    const shape = prism.Shape();
    extrudeVec.delete();
    prism.delete();
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);
    const t = bodyTessellation(ctx);
    const meshData = tessellate(ctx, shape, t.linearDeflection, t.angularDeflection);
    post({ type: 'featureBuilt', featureId, geometry: { shapeId, shapeType: ShapeType.SOLID }, meshData }, getTransferables(meshData));
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to extrude: ${formatError(err)}`, featureId });
  }
}

/**
 * Handle revolveSketch request
 */
export function handleRevolveSketch(
  ctx: WorkerContext,
  featureId: string,
  sketchId: string,
  params: RevolveParams
): void {
  const { oc } = ctx;
  try {
    const sketchShape = findSketchShape(ctx, sketchId);
    if (!sketchShape) throw new Error(`Sketch ${sketchId} not found`);
    const faceToRevolve = ensureFace(ctx, sketchShape);
    const axisOrigin = new oc.gp_Pnt_3(params.axis.origin.x, params.axis.origin.y, params.axis.origin.z);
    const axisDir = new oc.gp_Dir_4(params.axis.direction.x, params.axis.direction.y, params.axis.direction.z);
    const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);
    const angleRad = (params.angle * Math.PI) / 180;
    const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, angleRad, false);
    if (!revol.IsDone()) throw new Error('BRepPrimAPI_MakeRevol failed');
    const shape = revol.Shape();
    axisOrigin.delete(); axisDir.delete(); axis.delete(); revol.delete();
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);
    const t = bodyTessellation(ctx);
    const meshData = tessellate(ctx, shape, t.linearDeflection, t.angularDeflection);
    post({ type: 'featureBuilt', featureId, geometry: { shapeId, shapeType: ShapeType.SOLID }, meshData }, getTransferables(meshData));
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to revolve: ${formatError(err)}`, featureId });
  }
}

/**
 * Build a standalone primitive solid (box / cylinder / sphere / cone / torus /
 * wedge) from its parameters. Each primitive is centered/anchored via its
 * `center` param (default origin). Extracted from `handleRebuild` so the
 * type→OCC-constructor dispatch is unit-testable with a mocked kernel.
 *
 * Returns null when the primitive fails to build (e.g. degenerate params);
 * callers treat that as a no-op so one bad primitive can't abort the rebuild.
 */
export function buildPrimitiveShape(
  ctx: WorkerContext,
  type: FeatureOperation,
  params:
    | PrimitiveBoxParams
    | PrimitiveCylinderParams
    | PrimitiveSphereParams
    | PrimitiveConeParams
    | PrimitiveTorusParams
    | PrimitiveWedgeParams
): TopoDS_Shape | null {
  const { oc } = ctx;

  // Build each primitive at the world origin with its simplest ("_1"/box "_2")
  // scalar constructor. We deliberately avoid the gp_Ax2 placement overloads:
  // opencascade.js's runtime overload numbering does NOT match the shipped
  // .d.ts for the MakeOneAxis family (the existing cylinder uses `_2` for what
  // the typings call `_3`), so the scalar forms are the only ones we can call
  // by number without risking a BindingError. Positioning is done afterwards
  // with a translation to the requested `center`.
  let shape: TopoDS_Shape | null = null;
  switch (type) {
    case FeatureOperation.BOX: {
      const p = params as PrimitiveBoxParams;
      const maker = new oc.BRepPrimAPI_MakeBox_2(p.width, p.height, p.depth);
      shape = maker.Shape();
      maker.delete();
      break;
    }
    case FeatureOperation.CYLINDER: {
      const p = params as PrimitiveCylinderParams;
      const maker = new oc.BRepPrimAPI_MakeCylinder_1(p.radius, p.height);
      shape = maker.Shape();
      maker.delete();
      break;
    }
    case FeatureOperation.SPHERE: {
      const p = params as PrimitiveSphereParams;
      const maker = new oc.BRepPrimAPI_MakeSphere_1(p.radius);
      shape = maker.Shape();
      maker.delete();
      break;
    }
    case FeatureOperation.CONE: {
      const p = params as PrimitiveConeParams;
      const maker = new oc.BRepPrimAPI_MakeCone_1(p.radius1, p.radius2, p.height);
      shape = maker.Shape();
      maker.delete();
      break;
    }
    case FeatureOperation.TORUS: {
      const p = params as PrimitiveTorusParams;
      const maker = new oc.BRepPrimAPI_MakeTorus_1(p.majorRadius, p.minorRadius);
      shape = maker.Shape();
      maker.delete();
      break;
    }
    case FeatureOperation.WEDGE: {
      const p = params as PrimitiveWedgeParams;
      const maker = new oc.BRepPrimAPI_MakeWedge_1(p.width, p.height, p.depth, p.ltx);
      shape = maker.Shape();
      maker.delete();
      break;
    }
    default:
      return null;
  }

  if (!shape) return null;

  // Offset to the requested center (if any) — everything above is origin-built.
  const c = (params as { center?: Point3D }).center;
  if (c && (c.x || c.y || c.z)) {
    const trsf = new oc.gp_Trsf_1();
    const vec = new oc.gp_Vec_4(c.x || 0, c.y || 0, c.z || 0);
    trsf.SetTranslation_1(vec);
    const maker = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
    const moved = maker.IsDone() ? maker.Shape() : shape;
    maker.delete();
    vec.delete();
    trsf.delete();
    return moved;
  }
  return shape;
}

/**
 * Perform boolean operation on shapes
 */
export function performBooleanOperation(
  ctx: WorkerContext,
  operation: 'union' | 'intersect' | 'subtract',
  shape1: TopoDS_Shape,
  shape2: TopoDS_Shape
): TopoDS_Shape {
  const { oc } = ctx;
  const progressRange = new oc.Message_ProgressRange_1();
  try {
    switch (operation) {
      case 'union': {
        const fuse = new oc.BRepAlgoAPI_Fuse_3(shape1, shape2, progressRange);
        if (fuse.IsDone()) {
          const res = fuse.Shape();
          fuse.delete();
          return res;
        }
        fuse.delete();
        // A failed fuse still needs to produce *a* body so the rebuild can
        // continue; fall back to an unfused compound of both inputs (visibly
        // wrong, but not a crash) rather than silently discarding one shape.
        const comp = new oc.TopoDS_Compound();
        const builder = new oc.BRep_Builder();
        builder.MakeCompound(comp);
        builder.Add(comp, shape1);
        builder.Add(comp, shape2);
        builder.delete();
        return comp;
      }
      case 'subtract': {
        const cut = new oc.BRepAlgoAPI_Cut_3(shape1, shape2, progressRange);
        if (!cut.IsDone()) { cut.delete(); throw new Error('BRepAlgoAPI_Cut failed'); }
        const res = cut.Shape();
        cut.delete();
        return res;
      }
      case 'intersect': {
        const common = new oc.BRepAlgoAPI_Common_3(shape1, shape2, progressRange);
        if (!common.IsDone()) { common.delete(); throw new Error('BRepAlgoAPI_Common failed'); }
        const res = common.Shape();
        common.delete();
        return res;
      }
    }
  } finally {
    progressRange.delete();
  }
  return shape1;
}

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
      try {
        post({ type: 'rebuildProgress', progress: processedItems / totalItems, currentFeatureId: item.data.id });

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
            const shapeId = `sketch_${sketch.id}_${shapeIdCounter++}`;
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
          if (currentBody) ctx.shapeStorage.set(`feature_${feature.id}_${shapeIdCounter++}`, currentBody);
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
        console.error(`Failed to rebuild item ${item.data.id}:`, err);
        post({ type: 'error', message: `${item.data.name ?? item.data.id}: ${message}`, featureId: item.data.id });
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

/**
 * Handle getFaceGeometry request
 */
export function handleGetFaceGeometry(ctx: WorkerContext, faceId: number, shapeId: string): void {
  const { oc } = ctx;
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error(`Shape ${shapeId} not found`);
    const faceMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, faceMap);
    if (faceId < 0 || faceId >= faceMap.Extent()) throw new Error(`Face ${faceId} not found`);
    const targetFace = oc.TopoDS.Face_1(faceMap.FindKey(faceId + 1));
    const surface = oc.BRep_Tool.Surface_2(targetFace);
    const plane = new oc.Handle_Geom_Plane_2(surface.get()).get();
    const nx = plane.Axis().Direction().X(), ny = plane.Axis().Direction().Y(), nz = plane.Axis().Direction().Z();
    const px = plane.Location().X(), py = plane.Location().Y(), pz = plane.Location().Z();
    const t = px * nx + py * ny + pz * nz;
    
    // Find boundary edges of this face
    const boundaryEdges: string[] = [];
    const edgeMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(targetFace, oc.TopAbs_ShapeEnum.TopAbs_EDGE, edgeMap);
    
    // We need to find the index of these edges in the global shape to match the tags
    const globalEdgeMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, globalEdgeMap);
    
    for (let i = 1; i <= edgeMap.Extent(); i++) {
      const edge = edgeMap.FindKey(i);
      const globalIdx = globalEdgeMap.FindIndex(edge);
      if (globalIdx > 0) {
        boundaryEdges.push(`edge-${globalIdx - 1}`);
      }
    }
    
    post({ 
      type: 'faceGeometry', 
      faceId, 
      origin: { x: t * nx, y: t * ny, z: t * nz }, 
      normal: { x: nx, y: ny, z: nz }, 
      isPlanar: true,
      boundaryEdges 
    });
    
    edgeMap.delete();
    globalEdgeMap.delete();
    faceMap.delete();
  } catch (err: unknown) {
    // Scoped with a featureId (even a synthetic one keyed off the request) so a
    // single missed face-pick can't escalate into the app-wide fatal ErrorOverlay
    // that an unscoped error triggers (see useOpenCascade's `!msg.featureId` check).
    post({ type: 'error', message: `Failed to get face geometry: ${formatError(err)}`, featureId: `face-pick-${shapeId}` });
  }
}

/**
 * Handle getEdgeLoop request ("Select Loop"): return the edges of the wire that
 * contains the picked edge, in the same 0-based global-edge index scheme the
 * mesh's `edgeMapping` uses. Walks the body's wires, maps each wire's edges to
 * global indices, and delegates the selection to the pure `pickLoop`.
 */
export function handleGetEdgeLoop(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string,
  edgeIndex: number
): void {
  const { oc } = ctx;
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error(`Shape ${shapeId} not found`);

    // Global edge map — the index scheme edgeMapping/selections use (0-based).
    const globalEdgeMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, globalEdgeMap);

    // Each wire as a list of its global edge indices.
    const wireMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_WIRE, wireMap);
    const wires: number[][] = [];
    for (let w = 1; w <= wireMap.Extent(); w++) {
      const wire = wireMap.FindKey(w);
      const wireEdges = new oc.TopTools_IndexedMapOfShape_1();
      oc.TopExp.MapShapes_1(wire, oc.TopAbs_ShapeEnum.TopAbs_EDGE, wireEdges);
      const indices: number[] = [];
      for (let e = 1; e <= wireEdges.Extent(); e++) {
        const gi = globalEdgeMap.FindIndex(wireEdges.FindKey(e));
        if (gi > 0) indices.push(gi - 1);
      }
      wireEdges.delete();
      wires.push(indices);
    }

    const edgeIndices = pickLoop(wires, edgeIndex);

    wireMap.delete();
    globalEdgeMap.delete();
    post({ type: 'edgeLoop', requestId, edgeIndices });
  } catch (err: unknown) {
    // Scoped like face-pick so a missed loop query can't escalate to the fatal
    // app-wide error overlay.
    post({ type: 'error', message: `Failed to select loop: ${formatError(err)}`, featureId: `edge-loop-${requestId}` });
  }
}

/**
 * Handle resolveSelector request (ROADMAP §9.1, Phase 2): materialize a
 * selector string against a body's sub-shapes and post back fingerprinted
 * `StableRef[]` so the selection survives later topology renumbers.
 */
export function handleResolveSelector(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string,
  kind: SubShapeKind,
  selector: string
): void {
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error(`Shape ${shapeId} not found`);

    const descriptors = describeSubShapes(ctx, shape, kind);
    const matchedIndices = selectSubShapes(descriptors, selector);

    const subShapes = mapSubShapes(ctx, shape, kind);
    const refs: StableRef[] = matchedIndices.map((index) => ({
      kind,
      index,
      fingerprint: computeFingerprint(ctx, subShapes[index], kind, index),
    }));

    post({ type: 'selectorResolved', requestId, refs });
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to resolve selector: ${formatError(err)}`, featureId: `selector-${requestId}` });
  }
}

/**
 * Handle exportShape request (ROADMAP §3): serialize a stored body to a
 * standard interchange format and post the file text back to the main thread,
 * which triggers the browser download.
 */
export function handleExportShape(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string,
  format: ExportFormat
): void {
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error('No geometry to export — build a feature first');
    const content = exportShapeToString(ctx, shape, format);
    post({ type: 'exported', requestId, format, content });
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to export ${format.toUpperCase()}: ${formatError(err)}`, featureId: `export-${requestId}` });
  }
}

/**
 * Handle measureShape request (ROADMAP §4): compute a stored body's volume and
 * bounding box and post the readout back to the main thread.
 */
export function handleMeasureShape(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string
): void {
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error('No geometry to measure — build a feature first');
    const measurement = measureShape(ctx, shape);
    post({ type: 'measured', requestId, measurement });
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to measure shape: ${formatError(err)}`, featureId: `measure-${requestId}` });
  }
}

/**
 * Handle measureBetween request (ROADMAP §4): compute the distance (and angle,
 * when both selections are directional and non-parallel) between two picked
 * sub-shapes of a stored body.
 */
export function handleMeasureBetween(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string,
  a: MeasureSelection,
  b: MeasureSelection
): void {
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error('No geometry to measure — build a feature first');
    const measurement = measureBetween(ctx, shape, a, b);
    post({ type: 'measuredBetween', requestId, measurement });
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to measure selection: ${formatError(err)}`, featureId: `measure-${requestId}` });
  }
}
