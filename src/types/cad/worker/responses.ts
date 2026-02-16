import type { Point3D, Vector3D, ShapeReference } from '../geometry';
import type { MeshData, SketchEdgeData } from './mesh';

// ============================================================================
// Worker Response Types
// ============================================================================

/** Worker initialization complete */
export interface ReadyResponse {
  type: 'ready';
}

/** Sketch built successfully */
export interface SketchBuiltResponse {
  type: 'sketchBuilt';
  sketchId: string;
  geometry: ShapeReference;
  meshData: MeshData;
}

/** Feature built successfully */
export interface FeatureBuiltResponse {
  type: 'featureBuilt';
  featureId: string;
  geometry: ShapeReference;
  meshData: MeshData;
}

/** Full model rebuild complete */
export interface RebuildCompleteResponse {
  type: 'rebuildComplete';
  meshData: MeshData;
  shapeId: string;
  sketchEdges?: Record<string, SketchEdgeData>;
}

/** Rebuild progress update */
export interface RebuildProgressResponse {
  type: 'rebuildProgress';
  progress: number;
  currentFeatureId: string;
}

/** Face geometry properties response */
export interface FaceGeometryResponse {
  type: 'faceGeometry';
  faceId: number;
  origin: Point3D;
  normal: Vector3D;
  isPlanar: boolean;
}

/** Worker error occurred */
export interface ErrorResponse {
  type: 'error';
  message: string;
  featureId?: string;
}

/** Messages sent from OpenCascade worker to main thread */
export type WorkerResponse =
  | ReadyResponse
  | SketchBuiltResponse
  | FeatureBuiltResponse
  | RebuildCompleteResponse
  | RebuildProgressResponse
  | FaceGeometryResponse
  | ErrorResponse;
