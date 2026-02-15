import type { Point3D, Vector3D, ShapeReference } from './geometry';
import type { SketchElement, SketchPlane } from './sketch-elements';
import type { ExtrudeParams, RevolveParams, BooleanParams, OperationParams } from './operation-params';
import type { FeatureTool } from './tools';
import type { CADProject } from './project';

// ============================================================================
// Worker Message Types
// ============================================================================

/** Messages sent from main thread to OpenCascade worker */
export type WorkerRequest =
  | { type: 'init' }
  | { type: 'buildSketch'; sketchId: string; plane: SketchPlane; elements: SketchElement[] }
  | { type: 'extrudeSketch'; featureId: string; sketchId: string; params: ExtrudeParams }
  | { type: 'revolveSketch'; featureId: string; sketchId: string; params: RevolveParams }
  | { type: 'createPrimitive'; featureId: string; primitiveType: FeatureTool; params: OperationParams }
  | { type: 'booleanOperation'; featureId: string; params: BooleanParams; shapes: ShapeReference[] }
  | { type: 'rebuild'; project: CADProject }
  | { type: 'deleteShape'; shapeId: string }
  | { type: 'getFaceGeometry'; faceId: number; shapeId: string };

/** Messages sent from OpenCascade worker to main thread */
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'sketchBuilt'; sketchId: string; geometry: ShapeReference; meshData: MeshData }
  | { type: 'featureBuilt'; featureId: string; geometry: ShapeReference; meshData: MeshData }
  | { type: 'rebuildComplete'; meshData: MeshData; shapeId: string; sketchEdges?: Record<string, SketchEdgeData> }
  | { type: 'rebuildProgress'; progress: number; currentFeatureId: string }
  | { type: 'faceGeometry'; faceId: number; origin: Point3D; normal: Vector3D; isPlanar: boolean }
  | { type: 'error'; message: string; featureId?: string };

/** Per-sketch edge vertex data for wireframe rendering */
export interface SketchEdgeData {
  edgeVertices: Float32Array;
}

/** Mesh data transferred from worker to main thread */
export interface MeshData {
  /** Face vertices (positions) */
  faceVertices: Float32Array;
  /** Face normals */
  faceNormals: Float32Array;
  /** Face indices */
  faceIndices: Uint32Array;
  /** Edge vertices (positions) */
  edgeVertices: Float32Array;
  /** Edge indices */
  edgeIndices: Uint32Array;
  /** Maps each triangle index to its parent CAD face ID */
  faceMapping?: Uint32Array;
  /** Maps each edge segment index to its parent topological edge ID (0-based) */
  edgeMapping?: Uint32Array;
  /** Number of unique topological edges */
  edgeCount: number;
}
