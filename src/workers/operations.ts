/**
 * CAD Operation Handlers
 *
 * Handlers for sketch building, extrusion, revolution, rebuild, and other operations.
 */

import type { TopoDS_Shape } from 'opencascade.js';
import type {
  SketchElement,
  SketchPlane,
  ExtrudeParams,
  RevolveParams,
  PrimitiveBoxParams,
  CADProject,
  MeshData,
  SketchEdgeData,
  Point3D,
  Vector3D,
} from '@/types/cad';
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
    // Try to JSON stringify
    try {
      const json = JSON.stringify(err);
      if (json !== '{}') {
        return json;
      }
    } catch {
      // Fall through
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
      const wireShape = oc.TopoDS.Wire_1(wire);
      const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wireShape, false);

      if (!faceMaker.IsDone()) {
        console.warn('Could not create face from wire, using wire only');
      } else {
        shape = faceMaker.Face();
      }
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
    const shape = prism.Shape();

    // Store shape
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);

    // Tessellate for visualization
    const meshData = tessellate(ctx, shape, 0.1, 0.5);

    post(
      {
        type: 'featureBuilt',
        featureId,
        geometry: { shapeId, shapeType: 'solid' as const },
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
    const axisDir = new oc.gp_Dir_4(
      params.axis.direction.x,
      params.axis.direction.y,
      params.axis.direction.z
    );
    const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);

    // Perform revolution
    const angleRad = (params.angle * Math.PI) / 180;
    const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, angleRad, false);
    const shape = revol.Shape();

    // Store shape
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    ctx.shapeStorage.set(shapeId, shape);

    // Tessellate for visualization
    const meshData = tessellate(ctx, shape, 0.1, 0.5);

    post(
      {
        type: 'featureBuilt',
        featureId,
        geometry: { shapeId, shapeType: 'solid' as const },
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

  switch (operation) {
    case 'union':
      return new oc.BRepAlgoAPI_Fuse_3(shape1, shape2, progressRange).Shape();
    case 'intersect':
      return new oc.BRepAlgoAPI_Common_3(shape1, shape2, progressRange).Shape();
    case 'subtract':
      return new oc.BRepAlgoAPI_Cut_3(shape1, shape2, progressRange).Shape();
    default:
      throw new Error(`Unknown boolean operation: ${operation}`);
  }
}

/**
 * Handle full rebuild of project from feature history
 * @param ctx Worker context
 * @param project CAD project with feature history
 */
export function handleRebuild(ctx: WorkerContext, project: CADProject): void {
  const { oc } = ctx;

  try {
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
          const wireShape = oc.TopoDS.Wire_1(wire);
          const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wireShape, false);

          if (faceMaker.IsDone()) {
            shape = faceMaker.Face();
          }
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
            let newShape = prism.Shape();

            // Apply boolean operation if we have an existing body
            if (currentBody) {
              if (feature.type === 'extrude-boss') {
                currentBody = performBooleanOperation(ctx, 'union', currentBody, newShape);
              } else if (feature.type === 'extruded-cut') {
                currentBody = performBooleanOperation(ctx, 'subtract', currentBody, newShape);
              }
            } else {
              currentBody = newShape;
            }

            const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
            ctx.shapeStorage.set(shapeId, currentBody);
          }
        } else if (feature.type === 'revolved-boss' || feature.type === 'revolved-cut') {
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
            let newShape = revol.Shape();

            // Apply boolean operation if we have an existing body
            if (currentBody) {
              if (feature.type === 'revolved-boss') {
                currentBody = performBooleanOperation(ctx, 'union', currentBody, newShape);
              } else if (feature.type === 'revolved-cut') {
                currentBody = performBooleanOperation(ctx, 'subtract', currentBody, newShape);
              }
            } else {
              currentBody = newShape;
            }

            const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
            ctx.shapeStorage.set(shapeId, currentBody);
          }
        } else if (feature.type === 'box') {
          // Handle primitive box
          const params = feature.parameters as PrimitiveBoxParams;
          const center = params.center || { x: 0, y: 0, z: 0 };

          // Create box at origin first, then translate
          const dx = params.width;
          const dy = params.height;
          const dz = params.depth;

          // Create box with dimensions (positioned at origin corner)
          const box = new oc.BRepPrimAPI_MakeBox_1(dx, dy, dz);
          let newShape = box.Shape();

          // Translate to center if needed
          if (center.x !== 0 || center.y !== 0 || center.z !== 0) {
            const translation = new oc.gp_Vec_4(
              center.x - dx / 2,
              center.y - dy / 2,
              center.z + dz / 2 // OpenCascade creates box in positive Z
            );
            const transform = new oc.gp_Trsf_1();
            transform.SetTranslation_1(translation);
            const location = new oc.TopLoc_Location_2(transform);
            newShape = newShape.Moved(location, false);
          } else {
            // Center at origin
            const translation = new oc.gp_Vec_4(-dx / 2, -dy / 2, dz / 2);
            const transform = new oc.gp_Trsf_1();
            transform.SetTranslation_1(translation);
            const location = new oc.TopLoc_Location_2(transform);
            newShape = newShape.Moved(location, false);
          }

          // Apply boolean operation if we have an existing body
          if (currentBody) {
            currentBody = performBooleanOperation(ctx, 'union', currentBody, newShape);
          } else {
            currentBody = newShape;
          }

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

      const meshData = tessellate(ctx, currentBody, 0.1, 0.5);

      const transferables: ArrayBuffer[] = [...getTransferables(meshData)];

      // Add sketch edge buffers to transferables
      for (const edge of Object.values(sketchEdgesMap)) {
        transferables.push(edge.edgeVertices.buffer);
      }

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

      const transferables: ArrayBuffer[] = [];
      for (const edge of Object.values(sketchEdgesMap)) {
        transferables.push(edge.edgeVertices.buffer);
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
