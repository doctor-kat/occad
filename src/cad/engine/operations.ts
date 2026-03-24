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
  TransformParams,
  MeasureParams,
  CADProject,
  MeshData,
  SketchEdgeData,
  Point3D,
  Vector3D,
} from '@/cad/types';
import { ShapeType, FeatureOperation, TransformOperation, PlaneType } from '@/cad/types';
import type { WorkerContext } from './workerContext';
import { post } from './workerContext';
import { getTransferables, findSketchShape, ensureFace } from './helpers';
import { buildSketchWire } from './sketchBuilders';
import { tessellate, extractEdgeVertices } from './tessellation';
import { SketchSolver } from './SketchSolver';
import { reprojectExternalGeometry } from './sketch/externalGeometry';

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

    // 3. Build wire from sketch elements
    const wire = buildSketchWire(ctx, solvedSketch);

    // 4. Create face from wire (if closed)
    let shape: TopoDS_Shape = wire;
    try {
      const wireWire = oc.TopoDS.Wire_1(wire);
      const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wireWire, false);
      if (faceMaker.IsDone()) {
        shape = faceMaker.Face();
      }
      faceMaker.delete();
    } catch (err) {}

    // 5. Store shape
    const shapeId = `sketch_${sketch.id}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);

    // 6. Tessellate for visualization
    const meshData = tessellate(ctx, shape, 0.05, 0.3);

    post(
      {
        type: 'sketchBuilt',
        sketchId: sketch.id,
        geometry: { shapeId, shapeType: 'face' as const },
        meshData,
        solvedSketch,
      },
      getTransferables(meshData)
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
    const direction = params.direction || { x: 0, y: 0, z: 1 };
    const extrudeVec = new oc.gp_Vec_4(direction.x * params.distance, direction.y * params.distance, direction.z * params.distance);
    const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
    if (!prism.IsDone()) throw new Error('BRepPrimAPI_MakePrism failed');
    const shape = prism.Shape();
    extrudeVec.delete();
    prism.delete();
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);
    const meshData = tessellate(ctx, shape, 0.1, 0.5);
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
    const meshData = tessellate(ctx, shape, 0.1, 0.5);
    post({ type: 'featureBuilt', featureId, geometry: { shapeId, shapeType: ShapeType.SOLID }, meshData }, getTransferables(meshData));
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to revolve: ${formatError(err)}`, featureId });
  }
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
          fuse.delete(); progressRange.delete();
          return res;
        }
        fuse.delete();
        const comp = new oc.TopoDS_Compound();
        const builder = new oc.BRep_Builder();
        builder.MakeCompound(comp);
        builder.Add(comp, shape1);
        builder.Add(comp, shape2);
        progressRange.delete(); builder.delete();
        return comp;
      }
      case 'subtract': {
        const cut = new oc.BRepAlgoAPI_Cut_3(shape1, shape2, progressRange);
        const res = cut.Shape();
        cut.delete(); progressRange.delete();
        return res;
      }
      case 'intersect': {
        const common = new oc.BRepAlgoAPI_Common_3(shape1, shape2, progressRange);
        const res = common.Shape();
        common.delete(); progressRange.delete();
        return res;
      }
    }
  } catch (err) {
    progressRange.delete();
    return shape1;
  }
  return shape1;
}

/**
 * Handle full rebuild of project from feature history
 */
export async function handleRebuild(ctx: WorkerContext, project: CADProject): Promise<void> {
  const { oc } = ctx;

  try {
    post({ type: 'progress', message: 'Starting full rebuild...' });
    ctx.shapeStorage.clear();

    let currentBody: TopoDS_Shape | null = null;
    const sketchEdgesMap: Record<string, SketchEdgeData> = {};

    const items = [
      ...project.sketches.map(s => ({ type: 'sketch' as const, data: s, createdAt: s.createdAt })),
      ...project.features.map(f => ({ type: 'feature' as const, data: f, createdAt: f.createdAt }))
    ].sort((a, b) => a.createdAt - b.createdAt);

    const totalItems = items.length;
    let processedItems = 0;

    for (const item of items) {
      try {
        post({ type: 'rebuildProgress', progress: processedItems / totalItems, currentFeatureId: item.data.id });

        if (item.type === 'sketch') {
          const sketch = item.data;
          const sketchToSolve = currentBody ? reprojectExternalGeometry(ctx, sketch, currentBody) : sketch;
          const solvedSketch = await solver.solve(sketchToSolve);
          const wire = buildSketchWire(ctx, solvedSketch);
          let shape: TopoDS_Shape = wire;
          try {
            const wireWire = oc.TopoDS.Wire_1(wire);
            const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wireWire, false);
            if (faceMaker.IsDone()) shape = faceMaker.Face();
            faceMaker.delete();
          } catch (err) {}
          const shapeId = `sketch_${sketch.id}_${shapeIdCounter++}`;
          ctx.shapeStorage.set(shapeId, shape);
          try {
            const edgeVertices = extractEdgeVertices(ctx, shape, 0.05, 0.3);
            if (edgeVertices.length > 0) sketchEdgesMap[sketch.id] = { edgeVertices };
          } catch (err) {}
        } else if (item.type === 'feature') {
          const feature = item.data;
          if (feature.isSuppressed) { processedItems++; continue; }

          let newShape: TopoDS_Shape | null = null;

          if (feature.type === 'extrude-boss' || feature.type === FeatureOperation.EXTRUDED_CUT) {
            const sketchShape = findSketchShape(ctx, feature.sketchId!);
            if (sketchShape) {
              const faceToExtrude = ensureFace(ctx, sketchShape);
              const params = feature.parameters as ExtrudeParams;
              const direction = params.direction || { x: 0, y: 0, z: 1 };
              const extrudeVec = new oc.gp_Vec_4(direction.x * params.distance, direction.y * params.distance, direction.z * params.distance);
              const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
              if (prism.IsDone()) newShape = prism.Shape();
              extrudeVec.delete(); prism.delete();
            }
          } else if (feature.type === FeatureOperation.REVOLVED_BOSS || feature.type === FeatureOperation.REVOLVED_CUT) {
            const sketchShape = findSketchShape(ctx, feature.sketchId!);
            if (sketchShape) {
              const faceToRevolve = ensureFace(ctx, sketchShape);
              const params = feature.parameters as RevolveParams;
              const axisOrigin = new oc.gp_Pnt_3(params.axis.origin.x, params.axis.origin.y, params.axis.origin.z);
              const axisDir = new oc.gp_Dir_4(params.axis.direction.x, params.axis.direction.y, params.axis.direction.z);
              const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);
              const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, (params.angle * Math.PI) / 180, false);
              if (revol.IsDone()) newShape = revol.Shape();
              axisOrigin.delete(); axisDir.delete(); axis.delete(); revol.delete();
            }
          } else if (feature.type === 'box') {
            const params = feature.parameters as PrimitiveBoxParams;
            const box = new oc.BRepPrimAPI_MakeBox_2(params.width, params.height, params.depth);
            newShape = box.Shape();
            box.delete();
          } else if (feature.type === FeatureOperation.CYLINDER) {
            const params = feature.parameters as PrimitiveCylinderParams;
            const axisOrigin = new oc.gp_Pnt_3(params.center?.x || 0, params.center?.y || 0, params.center?.z || 0);
            const axis = new oc.gp_Ax2_3(axisOrigin, new oc.gp_Dir_4(0, 0, 1));
            const cylinder = new oc.BRepPrimAPI_MakeCylinder_2(axis, params.radius, params.height);
            if (cylinder.IsDone()) newShape = cylinder.Shape();
            axisOrigin.delete(); axis.delete(); cylinder.delete();
          }

          if (newShape && !newShape.IsNull()) {
            if (currentBody) {
              if (feature.type === 'extrude-boss' || feature.type === FeatureOperation.REVOLVED_BOSS || feature.type === 'box' || feature.type === FeatureOperation.CYLINDER) {
                currentBody = performBooleanOperation(ctx, 'union', currentBody, newShape);
              } else if (feature.type === FeatureOperation.EXTRUDED_CUT || feature.type === FeatureOperation.REVOLVED_CUT) {
                currentBody = performBooleanOperation(ctx, 'subtract', currentBody, newShape);
              }
            } else {
              currentBody = newShape;
            }
          }
          if (currentBody) ctx.shapeStorage.set(`feature_${feature.id}_${shapeIdCounter++}`, currentBody);
        }
        processedItems++;
      } catch (err: unknown) {
        console.error(`Failed to rebuild item ${item.data.id}:`, err);
      }
    }

    if (currentBody) {
      const finalShapeId = 'CURRENT_REBUILD_SHAPE';
      ctx.shapeStorage.set(finalShapeId, currentBody);
      const meshData = tessellate(ctx, currentBody, 0.1, 0.5);
      const transferables: Transferable[] = [...getTransferables(meshData)];
      for (const edge of Object.values(sketchEdgesMap)) transferables.push(edge.edgeVertices.buffer);
      post({ type: 'rebuildComplete', meshData, shapeId: finalShapeId, sketchEdges: sketchEdgesMap }, transferables);
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
    post({ type: 'error', message: `Failed to get face geometry: ${formatError(err)}` });
  }
}
