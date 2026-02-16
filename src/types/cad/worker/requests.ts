import type { SketchElement, SketchPlane } from '../sketch-elements';
import type { ExtrudeParams, RevolveParams, BooleanParams, OperationParams } from '../operation-params';
import type { FeatureTool } from '../tools';
import type { CADProject } from '../project';
import type { ShapeReference } from '../geometry';

// ============================================================================
// Worker Request Types
// ============================================================================

/** Initialize OpenCascade worker */
export interface InitRequest {
  type: 'init';
}

/** Build a sketch from 2D elements into a wire/face */
export interface BuildSketchRequest {
  type: 'buildSketch';
  sketchId: string;
  plane: SketchPlane;
  elements: SketchElement[];
}

/** Extrude a sketch to create a 3D feature */
export interface ExtrudeSketchRequest {
  type: 'extrudeSketch';
  featureId: string;
  sketchId: string;
  params: ExtrudeParams;
}

/** Revolve a sketch around an axis to create a 3D feature */
export interface RevolveSketchRequest {
  type: 'revolveSketch';
  featureId: string;
  sketchId: string;
  params: RevolveParams;
}

/** Create a primitive 3D shape (box, sphere, cylinder, etc.) */
export interface CreatePrimitiveRequest {
  type: 'createPrimitive';
  featureId: string;
  primitiveType: FeatureTool;
  params: OperationParams;
}

/** Perform boolean operation (union, subtract, intersect) on shapes */
export interface BooleanOperationRequest {
  type: 'booleanOperation';
  featureId: string;
  params: BooleanParams;
  shapes: ShapeReference[];
}

/** Rebuild entire CAD model from feature history */
export interface RebuildRequest {
  type: 'rebuild';
  project: CADProject;
}

/** Delete a shape from worker storage */
export interface DeleteShapeRequest {
  type: 'deleteShape';
  shapeId: string;
}

/** Get geometric properties of a face (origin, normal) */
export interface GetFaceGeometryRequest {
  type: 'getFaceGeometry';
  faceId: number;
  shapeId: string;
}

/** Messages sent from main thread to OpenCascade worker */
export type WorkerRequest =
  | InitRequest
  | BuildSketchRequest
  | ExtrudeSketchRequest
  | RevolveSketchRequest
  | CreatePrimitiveRequest
  | BooleanOperationRequest
  | RebuildRequest
  | DeleteShapeRequest
  | GetFaceGeometryRequest;
