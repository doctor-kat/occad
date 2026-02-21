/**
 * CAD Operation Handlers
 *
 * Handlers for sketch building, extrusion, revolution, rebuild, and other operations.
 */

type TopoDS_Shape = any;
import type {
  SketchElement,
  SketchPlane,
  ExtrudeParams,
  RevolveParams,
  PrimitiveBoxParams,
  PrimitiveCylinderParams,
  PrimitiveSphereParams,
  PrimitiveConeParams,
  PrimitiveTorusParams,
  PrimitiveWedgeParams,
  CADProject,
  MeshData,
  SketchEdgeData,
  Point3D,
  Vector3D,
} from '@/cad/types';
import { ShapeType, FeatureTool, PlaneType, SketchElementType } from '@/cad/types';
import type { WorkerContext } from './workerContext';
import { post } from './workerContext';
import { getTransferables, findSketchShape, ensureFace } from './helpers';
import { buildSketchWire } from './sketchBuilders';
import { tessellate, extractEdgeVertices } from './tessellation';

/** Counter for generating unique shape IDs */
let shapeIdCounter = 0;

/**
 * Format error object for display
 * OpenCascade C++ exceptions don't have proper message properties
 * @param err Error object (unknown type)
 * @returns Formatted error message
 */
function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    // Try to extract message property from OpenCascade exception
    const errObj = err as Record<string, unknown>;

    // Check for Emscripten's peculiar error representation
    if (typeof errObj === 'number') {
      return `OpenCascade error (code: ${errObj})`;
    }

    if (typeof errObj.message === 'string') {
      return errObj.message;
    }
    // Try toString method
    if (typeof errObj.toString === 'function') {
      const str = errObj.toString();
      // Don't return "[object Object]" or memory addresses
      if (str !== '[object Object]' && !/^\d+$/.test(str)) {
        return str;
      }
    }
    // If it's a number (pointer), try to get something meaningful
    if (typeof err === 'number') {
      return `OpenCascade exception (pointer: ${err})`;
    }

    // Return a generic message with the constructor name
    return `OpenCascade exception (${err.constructor?.name || 'unknown type'})`;
  }
  return String(err);
}

/**
 * Handle buildSketch request
 * @param ctx Worker context
 * @param sketchId Sketch ID
 * @param plane Sketch plane
 * @param elements Sketch elements
 */
export function handleBuildSketch(
  ctx: WorkerContext,
  sketchId: string,
  plane: SketchPlane,
  elements: SketchElement[]
): void {
  const { oc } = ctx;

  try {
    post({ type: 'progress', message: `Building sketch ${sketchId}...` });

    // Build wire from sketch elements
    const wire = buildSketchWire(ctx, elements, plane);

    // Create face from wire (if closed)
    let shape: TopoDS_Shape = wire;
    try {
      // Downcast TopoDS_Shape to TopoDS_Wire for type safety
      const wireWire = oc.TopoDS.Wire_1(wire);
      const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wireWire, false);

      if (!faceMaker.IsDone()) {
        console.warn('Could not create face from wire, using wire only');
      } else {
        shape = faceMaker.Face();
      }
      faceMaker.delete();
    } catch (err) {
      console.warn('Failed to create face from wire:', err);
    }

    // Store shape
    const shapeId = `sketch_${sketchId}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);

    // Tessellate for visualization
    const meshData = tessellate(ctx, shape, 0.05, 0.3);

    post(
      {
        type: 'sketchBuilt',
        sketchId,
        geometry: { shapeId, shapeType: 'face' as const },
        meshData,
      },
      getTransferables(meshData)
    );
  } catch (err: unknown) {
    const message = formatError(err);
    post({
      type: 'error',
      message: `Failed to build sketch: ${message}`,
      featureId: sketchId,
    });
  }
}

/**
 * Handle extrudeSketch request
 * @param ctx Worker context
 * @param featureId Feature ID
 * @param sketchId Sketch ID
 * @param params Extrude parameters
 */
export function handleExtrudeSketch(
  ctx: WorkerContext,
  featureId: string,
  sketchId: string,
  params: ExtrudeParams
): void {
  const { oc } = ctx;

  try {
    post({ type: 'progress', message: `Extruding sketch ${sketchId}...` });

    // Find sketch shape
    const sketchShape = findSketchShape(ctx, sketchId);
    if (!sketchShape) {
      throw new Error(`Sketch ${sketchId} not found in storage`);
    }

    // Get or create face from wire
    const faceToExtrude = ensureFace(ctx, sketchShape);

    // Create extrusion vector
    const direction = params.direction || { x: 0, y: 0, z: 1 }; // Default to Z-up
    const extrudeVec = new oc.gp_Vec_4(
      direction.x * params.distance,
      direction.y * params.distance,
      direction.z * params.distance
    );

    // Perform extrusion
    const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);

    if (!prism.IsDone()) {
      extrudeVec.delete();
      prism.delete();
      throw new Error('BRepPrimAPI_MakePrism failed');
    }

    const shape = prism.Shape();

    // Clean up
    extrudeVec.delete();
    prism.delete();

    // Store shape
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);

    // Tessellate for visualization
    const meshData = tessellate(ctx, shape, 0.1, 0.5);

    post(
      {
        type: 'featureBuilt',
        featureId,
        geometry: { shapeId, shapeType: ShapeType.SOLID },
        meshData,
      },
      getTransferables(meshData)
    );
  } catch (err: unknown) {
    const message = formatError(err);
    post({
      type: 'error',
      message: `Failed to extrude sketch: ${message}`,
      featureId,
    });
  }
}

/**
 * Handle revolveSketch request
 * @param ctx Worker context
 * @param featureId Feature ID
 * @param sketchId Sketch ID
 * @param params Revolve parameters
 */
export function handleRevolveSketch(
  ctx: WorkerContext,
  featureId: string,
  sketchId: string,
  params: RevolveParams
): void {
  const { oc } = ctx;

  try {
    post({ type: 'progress', message: `Revolving sketch ${sketchId}...` });

    // Find sketch shape
    const sketchShape = findSketchShape(ctx, sketchId);
    if (!sketchShape) {
      throw new Error(`Sketch ${sketchId} not found in storage`);
    }

    // Get or create face from wire
    const faceToRevolve = ensureFace(ctx, sketchShape);

    // Create axis of revolution
    const axisOrigin = new oc.gp_Pnt_3(params.axis.origin.x, params.axis.origin.y, params.axis.origin.z);
    let axisDir: any;
    try {
      axisDir = new oc.gp_Dir_4(
        params.axis.direction.x,
        params.axis.direction.y,
        params.axis.direction.z
      );
    } catch (e) {
      axisOrigin.delete();
      throw new Error('Invalid axis direction vector');
    }

    const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);

    // Perform revolution
    const angleRad = (params.angle * Math.PI) / 180;
    const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, angleRad, false);

    if (!revol.IsDone()) {
      axisOrigin.delete();
      axisDir.delete();
      axis.delete();
      revol.delete();
      throw new Error('BRepPrimAPI_MakeRevol failed');
    }

    const shape = revol.Shape();

    // Clean up
    axisOrigin.delete();
    axisDir.delete();
    axis.delete();
    revol.delete();

    // Store shape
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);

    // Tessellate for visualization
    const meshData = tessellate(ctx, shape, 0.1, 0.5);

    post(
      {
        type: 'featureBuilt',
        featureId,
        geometry: { shapeId, shapeType: ShapeType.SOLID },
        meshData,
      },
      getTransferables(meshData)
    );
  } catch (err: unknown) {
    const message = formatError(err);
    post({
      type: 'error',
      message: `Failed to revolve sketch: ${message}`,
      featureId,
    });
  }
}

/**
 * Perform boolean operation on shapes
 * @param ctx Worker context
 * @param operation Boolean operation type
 * @param shape1 First shape
 * @param shape2 Second shape
 * @returns Result shape
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
        let res = fuse.Shape();

        // Check if fuse succeeded and result is valid
        if (fuse.IsDone() && !res.IsNull() && validateShape(ctx, res)) {
          fuse.delete();
          progressRange.delete();
          return res;
        }

        console.log('[OC Worker] Standard union failed or resulting shape empty, falling back to compound');
        fuse.delete();

        // Fallback: Manually create a compound of the two shapes
        // This is useful for disjoint shapes where Fuse might fail or be overkill
        const comp = new oc.TopoDS_Compound();
        const builder = new oc.BRep_Builder();
        builder.MakeCompound(comp);
        builder.Add(comp, shape1);
        builder.Add(comp, shape2);

        progressRange.delete();
        builder.delete();
        return comp;
      }
      case 'intersect': {
        const common = new oc.BRepAlgoAPI_Common_3(shape1, shape2, progressRange);
        const res = common.Shape();
        common.delete();
        progressRange.delete();
        return res;
      }
      case 'subtract': {
        const cut = new oc.BRepAlgoAPI_Cut_3(shape1, shape2, progressRange);
        const res = cut.Shape();
        cut.delete();
        progressRange.delete();
        return res;
      }
      default:
        progressRange.delete();
        throw new Error(`Unknown boolean operation: ${operation}`);
    }
  } catch (err) {
    console.error(`[OC Worker] Boolean operation ${operation} crashed:`, err);
    progressRange.delete();
    // Return original shape1 as a safe fallback for boss operations
    return shape1;
  }
}

/**
 * Validate that a shape is valid and has expected geometric entities
 * @param ctx Worker context
 * @param shape Shape to validate
 * @returns true if shape is valid and non-empty
 */
function validateShape(ctx: WorkerContext, shape: TopoDS_Shape): boolean {
  const { oc } = ctx;
  if (shape.IsNull()) return false;

  const faceExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  let faceCount = 0;
  for (; faceExplorer.More(); faceExplorer.Next()) faceCount++;
  faceExplorer.delete();

  return faceCount > 0;
}

/**
 * Handle full rebuild of project from feature history
 * @param ctx Worker context
 * @param project CAD project with feature history
 */
export function handleRebuild(ctx: WorkerContext, project: CADProject): void {
  const { oc } = ctx;

  try {
    console.log(`[OC Worker] handleRebuild starting for ${project.features.length} features, ${project.sketches.length} sketches`);
    post({ type: 'progress', message: 'Starting full rebuild...' });

    // Clear existing shapes
    ctx.shapeStorage.clear();

    let currentBody: TopoDS_Shape | null = null;

    // First pass: Build all sketches
    for (const sketch of project.sketches) {
      try {
        post({
          type: 'rebuildProgress',
          progress: 0,
          currentFeatureId: sketch.id,
        });

        const wire = buildSketchWire(ctx, sketch.elements, sketch.plane);
        let shape: TopoDS_Shape = wire;

        try {
          // Downcast TopoDS_Shape to TopoDS_Wire for type safety
          const wireWire = oc.TopoDS.Wire_1(wire);
          const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wireWire, false);

          if (faceMaker.IsDone()) {
            shape = faceMaker.Face();
          }
          faceMaker.delete();
        } catch (err) {
          console.warn(`Could not create face for sketch ${sketch.id}`);
        }

        const shapeId = `sketch_${sketch.id}_${shapeIdCounter++}`;
        ctx.shapeStorage.set(shapeId, shape);
      } catch (err: unknown) {
        const message = formatError(err);
        console.error(`Failed to rebuild sketch ${sketch.id}:`, err);
        post({ type: 'error', message: `Sketch failed: ${message}`, featureId: sketch.id });
      }
    }

    // Collect sketch edge data for wireframe rendering
    const sketchEdgesMap: Record<string, SketchEdgeData> = {};
    for (const sketch of project.sketches) {
      const sketchShape = findSketchShape(ctx, sketch.id);
      if (sketchShape) {
        try {
          const edgeVertices = extractEdgeVertices(ctx, sketchShape, 0.05, 0.3);
          if (edgeVertices.length > 0) {
            sketchEdgesMap[sketch.id] = { edgeVertices };
          }
        } catch (err) {
          // Non-fatal: skip edge extraction for this sketch
        }
      }
    }

    console.log(`[OC Worker] Built ${project.sketches.length} sketches. Features pass starting...`);

    // Second pass: Build all features in order
    const totalFeatures = project.features.filter(f => !f.isSuppressed).length;
    let processedFeatures = 0;

    for (const feature of project.features) {
      if (feature.isSuppressed) continue;

      try {
        post({
          type: 'rebuildProgress',
          progress: processedFeatures / totalFeatures,
          currentFeatureId: feature.id,
        });

        if (feature.type === 'extrude-boss' || feature.type === 'extruded-cut') {
          // Handle extrude features
          const sketchShape = findSketchShape(ctx, feature.sketchId!);

          if (sketchShape) {
            const faceToExtrude = ensureFace(ctx, sketchShape);

            const params = feature.parameters as ExtrudeParams;
            const direction = params.direction || { x: 0, y: 0, z: 1 };
            const extrudeVec = new oc.gp_Vec_4(
              direction.x * params.distance,
              direction.y * params.distance,
              direction.z * params.distance
            );

            const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
            if (!prism.IsDone()) {
              extrudeVec.delete();
              prism.delete();
              throw new Error('BRepPrimAPI_MakePrism failed');
            }
            let newShape = prism.Shape();
            if (newShape.IsNull()) {
              extrudeVec.delete();
              prism.delete();
              throw new Error('BRepPrimAPI_MakePrism returned null shape');
            }

            // Clean up temporary objects
            extrudeVec.delete();
            prism.delete();

            // Apply boolean operation if we have an existing body
            if (currentBody) {
              if (feature.type === 'extrude-boss') {
                const result = performBooleanOperation(ctx, 'union', currentBody, newShape);
                if (!result.IsNull()) {
                  currentBody = result;
                } else {
                  console.error(`Boolean union failed for feature ${feature.id}`);
                }
              } else if (feature.type === FeatureTool.EXTRUDED_CUT) {
                const result = performBooleanOperation(ctx, 'subtract', currentBody, newShape);
                if (!result.IsNull()) {
                  currentBody = result;
                } else {
                  console.error(`Boolean subtract failed for feature ${feature.id}`);
                }
              }
            } else {
              currentBody = newShape;
            }

            const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
            ctx.shapeStorage.set(shapeId, currentBody);
          }
        } else if (feature.type === FeatureTool.REVOLVED_BOSS || feature.type === FeatureTool.REVOLVED_CUT) {
          // Handle revolve features
          const sketchShape = findSketchShape(ctx, feature.sketchId!);

          if (sketchShape) {
            const faceToRevolve = ensureFace(ctx, sketchShape);

            const params = feature.parameters as RevolveParams;
            const axisOrigin = new oc.gp_Pnt_3(
              params.axis.origin.x,
              params.axis.origin.y,
              params.axis.origin.z
            );
            const axisDir = new oc.gp_Dir_4(
              params.axis.direction.x,
              params.axis.direction.y,
              params.axis.direction.z
            );
            const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);

            const angleRad = (params.angle * Math.PI) / 180;
            const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, angleRad, false);
            if (!revol.IsDone()) {
              axisOrigin.delete();
              axisDir.delete();
              axis.delete();
              revol.delete();
              throw new Error('BRepPrimAPI_MakeRevol failed');
            }
            let newShape = revol.Shape();
            if (newShape.IsNull()) {
              axisOrigin.delete();
              axisDir.delete();
              axis.delete();
              revol.delete();
              throw new Error('BRepPrimAPI_MakeRevol returned null shape');
            }

            // Apply boolean operation if we have an existing body
            if (currentBody) {
              if (feature.type === 'revolved-boss') {
                const result = performBooleanOperation(ctx, 'union', currentBody, newShape);
                if (!result.IsNull() && validateShape(ctx, result)) {
                  currentBody = result;
                } else {
                  console.error(`Boolean union failed for revolved feature ${feature.id}`);
                }
              } else if (feature.type === 'revolved-cut') {
                const result = performBooleanOperation(ctx, 'subtract', currentBody, newShape);
                if (!result.IsNull() && validateShape(ctx, result)) {
                  currentBody = result;
                } else {
                  console.error(`Boolean subtract failed for revolved feature ${feature.id}`);
                }
              }
            } else {
              currentBody = newShape;
            }

            // Clean up temporary objects
            axisOrigin.delete();
            axisDir.delete();
            axis.delete();
            revol.delete();

            const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
            ctx.shapeStorage.set(shapeId, currentBody);
          }
        } else if (feature.type === 'box') {
          // Handle primitive box
          const params = feature.parameters as PrimitiveBoxParams;
          const center = params.center || { x: 0, y: 0, z: 0 };

          const dx = params.width;
          const dy = params.height;
          const dz = params.depth;

          // Create coordinate system centered at (center.x-dx/2, center.y-dy/2, center.z-dz/2)
          // or just use the center point and offset the box? 
          // BRepPrimAPI_MakeBox(Pmin, Pmax) is very clean for this.

          // Try BRepPrimAPI_MakeBox_2 with dx, dy, dz
          const box = new oc.BRepPrimAPI_MakeBox_2(dx, dy, dz);
          let newShape = box.Shape();
          
          // Apply boolean operation if we have an existing body
          if (currentBody) {
            const result = performBooleanOperation(ctx, 'union', currentBody, newShape);
            if (!result.IsNull() && validateShape(ctx, result)) {
              currentBody = result;
            } else {
              console.error(`Boolean union failed for box feature ${feature.id}`);
            }
          } else {
            currentBody = newShape;
          }

          box.delete();

          const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
          ctx.shapeStorage.set(shapeId, currentBody);
        } else if (feature.type === FeatureTool.CYLINDER) {
          // Handle primitive cylinder
          const params = feature.parameters as PrimitiveCylinderParams;
          const center = params.center || { x: 0, y: 0, z: 0 };

          const axisOrigin = new oc.gp_Pnt_3(center.x, center.y, center.z);
          const axisDir = new oc.gp_Dir_4(0, 0, 1); // Default to Z-up
          const axis = new oc.gp_Ax2_3(axisOrigin, axisDir);

          const cylinder = new oc.BRepPrimAPI_MakeCylinder_2(axis, params.radius, params.height);
          if (!cylinder.IsDone()) {
            axisOrigin.delete();
            axisDir.delete();
            axis.delete();
            cylinder.delete();
            throw new Error('BRepPrimAPI_MakeCylinder failed');
          }
          const newShape = cylinder.Shape();
          if (newShape.IsNull()) {
            axisOrigin.delete();
            axisDir.delete();
            axis.delete();
            cylinder.delete();
            throw new Error('BRepPrimAPI_MakeCylinder returned null shape');
          }

          // Apply boolean operation if we have an existing body
          if (currentBody) {
            const result = performBooleanOperation(ctx, 'union', currentBody, newShape);
            if (!result.IsNull() && validateShape(ctx, result)) {
              currentBody = result;
            } else {
              console.error(`Boolean union failed for cylinder feature ${feature.id}`);
            }
          } else {
            currentBody = newShape;
          }

          axisOrigin.delete();
          axisDir.delete();
          axis.delete();
          cylinder.delete();

          const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
          ctx.shapeStorage.set(shapeId, currentBody);
        } else if (feature.type === FeatureTool.SPHERE) {
          // Handle primitive sphere
          const params = feature.parameters as PrimitiveSphereParams;
          const center = params.center || { x: 0, y: 0, z: 0 };

          const axisOrigin = new oc.gp_Pnt_3(center.x, center.y, center.z);
          const sphere = new oc.BRepPrimAPI_MakeSphere_4(axisOrigin, params.radius);
          if (!sphere.IsDone()) {
            axisOrigin.delete();
            sphere.delete();
            throw new Error('BRepPrimAPI_MakeSphere failed');
          }
          const newShape = sphere.Shape();
          if (newShape.IsNull()) {
            axisOrigin.delete();
            sphere.delete();
            throw new Error('BRepPrimAPI_MakeSphere returned null shape');
          }

          // Apply boolean operation if we have an existing body
          if (currentBody) {
            const result = performBooleanOperation(ctx, 'union', currentBody, newShape);
            if (!result.IsNull() && validateShape(ctx, result)) {
              currentBody = result;
            } else {
              console.error(`Boolean union failed for sphere feature ${feature.id}`);
            }
          } else {
            currentBody = newShape;
          }

          axisOrigin.delete();
          sphere.delete();

          const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
          ctx.shapeStorage.set(shapeId, currentBody);
        } else if (feature.type === FeatureTool.CONE) {
          // Handle primitive cone
          const params = feature.parameters as PrimitiveConeParams;
          const center = params.center || { x: 0, y: 0, z: 0 };

          const axisOrigin = new oc.gp_Pnt_3(center.x, center.y, center.z);
          const axisDir = new oc.gp_Dir_4(0, 0, 1); // Default to Z-up
          const axis = new oc.gp_Ax2_3(axisOrigin, axisDir);

          const cone = new oc.BRepPrimAPI_MakeCone_2(axis, params.radius1, params.radius2, params.height);
          if (!cone.IsDone()) {
            axisOrigin.delete();
            axisDir.delete();
            axis.delete();
            cone.delete();
            throw new Error('BRepPrimAPI_MakeCone failed');
          }
          const newShape = cone.Shape();
          if (newShape.IsNull()) {
            axisOrigin.delete();
            axisDir.delete();
            axis.delete();
            cone.delete();
            throw new Error('BRepPrimAPI_MakeCone returned null shape');
          }

          // Apply boolean operation if we have an existing body
          if (currentBody) {
            const result = performBooleanOperation(ctx, 'union', currentBody, newShape);
            if (!result.IsNull() && validateShape(ctx, result)) {
              currentBody = result;
            } else {
              console.error(`Boolean union failed for cone feature ${feature.id}`);
            }
          } else {
            currentBody = newShape;
          }

          axisOrigin.delete();
          axisDir.delete();
          axis.delete();
          cone.delete();

          const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
          ctx.shapeStorage.set(shapeId, currentBody);
        } else if (feature.type === FeatureTool.TORUS) {
          // Handle primitive torus
          const params = feature.parameters as PrimitiveTorusParams;
          const center = params.center || { x: 0, y: 0, z: 0 };

          const axisOrigin = new oc.gp_Pnt_3(center.x, center.y, center.z);
          const axisDir = new oc.gp_Dir_4(0, 0, 1); // Default to Z-up
          const axis = new oc.gp_Ax2_3(axisOrigin, axisDir);

          const torus = new oc.BRepPrimAPI_MakeTorus_1(axis, params.majorRadius, params.minorRadius);
          if (!torus.IsDone()) {
            axisOrigin.delete();
            axisDir.delete();
            axis.delete();
            torus.delete();
            throw new Error('BRepPrimAPI_MakeTorus failed');
          }
          const newShape = torus.Shape();
          if (newShape.IsNull()) {
            axisOrigin.delete();
            axisDir.delete();
            axis.delete();
            torus.delete();
            throw new Error('BRepPrimAPI_MakeTorus returned null shape');
          }

          // Apply boolean operation if we have an existing body
          if (currentBody) {
            const result = performBooleanOperation(ctx, 'union', currentBody, newShape);
            if (!result.IsNull() && validateShape(ctx, result)) {
              currentBody = result;
            } else {
              console.error(`Boolean union failed for torus feature ${feature.id}`);
            }
          } else {
            currentBody = newShape;
          }

          axisOrigin.delete();
          axisDir.delete();
          axis.delete();
          torus.delete();

          const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
          ctx.shapeStorage.set(shapeId, currentBody);
        } else if (feature.type === FeatureTool.WEDGE) {
          // Handle primitive wedge
          const params = feature.parameters as PrimitiveWedgeParams;
          const center = params.center || { x: 0, y: 0, z: 0 };

          // BRepPrimAPI_MakeWedge_4(dx, dy, dz, ltx)
          const wedge = new oc.BRepPrimAPI_MakeWedge_4(params.width, params.height, params.depth, params.ltx);
          if (!wedge.IsDone()) {
            wedge.delete();
            throw new Error('BRepPrimAPI_MakeWedge failed');
          }
          const newShape = wedge.Shape();
          if (newShape.IsNull()) {
            wedge.delete();
            throw new Error('BRepPrimAPI_MakeWedge returned null shape');
          }

          // Apply boolean operation if we have an existing body
          if (currentBody) {
            const result = performBooleanOperation(ctx, 'union', currentBody, newShape);
            if (!result.IsNull() && validateShape(ctx, result)) {
              currentBody = result;
            } else {
              console.error(`Boolean union failed for wedge feature ${feature.id}`);
            }
          } else {
            currentBody = newShape;
          }

          wedge.delete();

          const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
          ctx.shapeStorage.set(shapeId, currentBody);
        }

        processedFeatures++;
      } catch (err: unknown) {
        const message = formatError(err);
        console.error(`Failed to rebuild feature ${feature.id}:`, err);
        post({ type: 'error', message: `Feature failed: ${message}`, featureId: feature.id });
      }
    }

    // Tessellate final body
    if (currentBody) {
      // Store the final body with a known ID for face geometry queries
      const finalShapeId = `rebuild_final_${shapeIdCounter++}`;
      ctx.shapeStorage.set(finalShapeId, currentBody);

      console.log(`[OC Worker] Rebuild complete. Final body found. Tessellating...`);
      const meshData = tessellate(ctx, currentBody, 0.1, 0.5);
      console.log(`[OC Worker] Tessellation finished. Vertices: ${meshData.faceVertices.length / 3}, Faces: ${meshData.faceIndices.length / 3}`);

      const transferables: Transferable[] = [...getTransferables(meshData)];

      // Add sketch edge buffers to transferables
      for (const edge of Object.values(sketchEdgesMap)) {
        transferables.push(edge.edgeVertices.buffer);
      }

      console.log(`[OC Worker] Rebuild complete. Final shape ID: ${finalShapeId}. Mesh generated with ${meshData.faceVertices.length / 3} vertices.`);
      post(
        { type: 'rebuildComplete', meshData, shapeId: finalShapeId, sketchEdges: sketchEdgesMap },
        transferables
      );
    } else {
      // No features to build - this is valid when project only has sketches or is empty
      // Return empty mesh data instead of an error
      const emptyMeshData: MeshData = {
        faceVertices: new Float32Array(0),
        faceNormals: new Float32Array(0),
        faceIndices: new Uint32Array(0),
        edgeVertices: new Float32Array(0),
        edgeIndices: new Uint32Array(0),
        faceMapping: new Uint32Array(0),
        edgeCount: 0,
      };

      const transferables: Transferable[] = [];
      for (const edge of Object.values(sketchEdgesMap)) {
        transferables.push(edge.edgeVertices.buffer as any);
      }

      post(
        { type: 'rebuildComplete', meshData: emptyMeshData, shapeId: '', sketchEdges: sketchEdgesMap },
        transferables
      );
    }
  } catch (err: unknown) {
    const message = formatError(err);
    post({
      type: 'error',
      message: `Rebuild failed: ${message}`,
    });
  }
}

/**
 * Handle getFaceGeometry request - extract plane origin and normal from a face
 * @param ctx Worker context
 * @param faceId Face ID (0-based index)
 * @param shapeId Shape ID in storage
 */
export function handleGetFaceGeometry(ctx: WorkerContext, faceId: number, shapeId: string): void {
  const { oc } = ctx;

  try {
    post({ type: 'progress', message: `Getting face geometry for face ${faceId}...` });

    // Get the shape from storage
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) {
      throw new Error(`Shape ${shapeId} not found in storage`);
    }

    // Iterate through faces to find the one with matching ID
    const faceExplorer = new oc.TopExp_Explorer_2(
      shape,
      oc.TopAbs_ShapeEnum.TopAbs_FACE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    let currentFaceId = 0;
    let targetFace = null;

    for (; faceExplorer.More(); faceExplorer.Next()) {
      if (currentFaceId === faceId) {
        targetFace = oc.TopoDS.Face_1(faceExplorer.Current());
        break;
      }
      currentFaceId++;
    }

    if (!targetFace) {
      throw new Error(`Face ${faceId} not found in shape ${shapeId}`);
    }

    // Get the surface from the face
    const surface = oc.BRep_Tool.Surface_2(targetFace);

    // Check if it's a planar surface
    const surfaceTypeName = surface.get().$$.ptrType.name;
    const isPlanar = surfaceTypeName === 'Geom_Plane*';

    if (!isPlanar) {
      // Non-planar face - return error
      post({
        type: 'error',
        message: 'Cannot create sketch on non-planar face. Please select a flat face.',
      });
      return;
    }

    // Extract plane geometry
    const plane = new oc.Handle_Geom_Plane_2(surface.get()).get();
    const planeLocation = plane.Location();
    const planeAxis = plane.Axis();
    const planeNormal = planeAxis.Direction();

    // Extract plane normal and OCC surface origin
    const nx = planeNormal.X();
    const ny = planeNormal.Y();
    const nz = planeNormal.Z();
    const px = planeLocation.X();
    const py = planeLocation.Y();
    const pz = planeLocation.Z();

    // Project global origin (0,0,0) onto the plane
    // This ensures sketch (0,0) aligns with project origin, matching default XY/XZ/YZ planes
    // Formula: t = dot(P - O, N) / dot(N, N), projected = O + t*N
    // Since O=(0,0,0) and N is unit vector, simplifies to: t = dot(P, N)
    const t = px * nx + py * ny + pz * nz;
    const origin: Point3D = {
      x: t * nx,
      y: t * ny,
      z: t * nz,
    };

    const normal: Vector3D = {
      x: nx,
      y: ny,
      z: nz,
    };

    // Send response
    post({
      type: 'faceGeometry',
      faceId,
      origin,
      normal,
      isPlanar: true,
    });
  } catch (err: unknown) {
    const message = formatError(err);
    post({
      type: 'error',
      message: `Failed to get face geometry: ${message}`,
    });
  }
}
