// CAD Application Types

// ============================================================================
// Geometry & OpenCascade Types
// ============================================================================

/** 3D Point */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** 2D Point (for sketch geometry) */
export interface Point2D {
  x: number;
  y: number;
}

/** Vector for directions and extrusion */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/** Axis definition for revolve operations */
export interface Axis {
  origin: Point3D;
  direction: Vector3D;
}

/** Reference to OpenCascade shape in worker */
export interface ShapeReference {
  /** Unique ID for this shape in the worker */
  shapeId: string;
  /** Type of shape (solid, face, wire, edge) */
  shapeType: 'solid' | 'face' | 'wire' | 'edge' | 'vertex';
}

// ============================================================================
// Sketch Geometry Types
// ============================================================================

export type SketchElementType = 'line' | 'circle' | 'arc' | 'rectangle' | 'polygon' | 'ellipse' | 'spline' | 'bezier';

export interface SketchLine {
  type: 'line';
  id: string;
  start: Point2D;
  end: Point2D;
}

export interface SketchCircle {
  type: 'circle';
  id: string;
  center: Point2D;
  radius: number;
}

export interface SketchArc {
  type: 'arc';
  id: string;
  /** Three points defining the arc (start, mid, end) or center-based definition */
  points?: [Point2D, Point2D, Point2D];
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

export interface SketchRectangle {
  type: 'rectangle';
  id: string;
  corner1: Point2D;
  corner2: Point2D;
}

export interface SketchPolygon {
  type: 'polygon';
  id: string;
  points: Point2D[];
}

export interface SketchEllipse {
  type: 'ellipse';
  id: string;
  center: Point2D;
  majorRadius: number;
  minorRadius: number;
  rotation: number; // angle in radians
}

export interface SketchSpline {
  type: 'spline';
  id: string;
  points: Point2D[];
  degree?: number; // B-spline degree (default 3)
}

export interface SketchBezier {
  type: 'bezier';
  id: string;
  controlPoints: Point2D[];
}

export type SketchElement =
  | SketchLine
  | SketchCircle
  | SketchArc
  | SketchRectangle
  | SketchPolygon
  | SketchEllipse
  | SketchSpline
  | SketchBezier;

/** Sketch plane definition */
export interface SketchPlane {
  /** Reference plane ID or face reference */
  planeRef: string;
  /** Plane type */
  type: 'xy' | 'yz' | 'xz' | 'face' | 'custom';
  /** For custom planes - origin and normal */
  origin?: Point3D;
  normal?: Vector3D;
  /** Offset from reference plane */
  offset?: number;
}

// ============================================================================
// Operation Parameter Types
// ============================================================================

export interface ExtrudeParams {
  /** Distance to extrude (can be negative for opposite direction) */
  distance: number;
  /** Direction vector (optional, defaults to sketch plane normal) */
  direction?: Vector3D;
  /** Draft angle in degrees (0 = straight extrusion) */
  draftAngle?: number;
  /** Whether this is a boss (adds material) or cut (removes material) */
  isCut: boolean;
}

export interface RevolveParams {
  /** Axis of revolution */
  axis: Axis;
  /** Angle in degrees (360 for full revolution) */
  angle: number;
  /** Whether this is a boss (adds material) or cut (removes material) */
  isCut: boolean;
}

export interface PrimitiveBoxParams {
  width: number;
  height: number;
  depth: number;
  center?: Point3D;
}

export interface PrimitiveSphereParams {
  radius: number;
  center?: Point3D;
}

export interface PrimitiveCylinderParams {
  radius: number;
  height: number;
  center?: Point3D;
}

export interface PrimitiveConeParams {
  radius1: number;
  radius2: number;
  height: number;
  center?: Point3D;
}

export interface PrimitiveTorusParams {
  majorRadius: number;
  minorRadius: number;
  center?: Point3D;
}

export interface BooleanParams {
  /** IDs of features to combine */
  featureIds: string[];
  /** Operation type */
  operation: 'union' | 'intersect' | 'subtract';
}

export interface FilletParams {
  /** Radius of the fillet */
  radius: number;
  /** Edge references to fillet */
  edges: string[];
}

export interface ChamferParams {
  /** Distance of the chamfer */
  distance: number;
  /** Edge references to chamfer */
  edges: string[];
}

export type OperationParams =
  | ExtrudeParams
  | RevolveParams
  | PrimitiveBoxParams
  | PrimitiveSphereParams
  | PrimitiveCylinderParams
  | PrimitiveConeParams
  | PrimitiveTorusParams
  | BooleanParams
  | FilletParams
  | ChamferParams;

// ============================================================================
// Tool & Category Types
// ============================================================================

export type ToolCategory = 'features' | 'sketch' | 'evaluate' | 'transform' | 'io';

export type FeatureTool =
  // Boss/Base operations
  | 'extrude-boss'
  | 'revolved-boss'
  // Cut operations
  | 'extruded-cut'
  | 'revolved-cut'
  // Primitives
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'wedge'
  // 3D Operations
  | 'sweep'
  | 'loft'
  // Boolean Operations
  | 'union'
  | 'intersect'
  // Modifications
  | 'fillet'
  | 'chamfer'
  | 'shell'
  | 'offset';

export type SketchTool =
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'polygon'
  | 'arc'
  | 'ellipse'
  | 'spline'
  | 'bezier';

export type EvaluateTool = 'measure';

export type TransformTool =
  | 'move'
  | 'rotate'
  | 'mirror'
  | 'scale';

export type IOTool =
  | 'import-step'
  | 'import-iges'
  | 'export-step'
  | 'export-iges'
  | 'export-stl'
  | 'export-gltf';

export type Tool = FeatureTool | SketchTool | EvaluateTool | TransformTool | IOTool | null;

export interface Sketch {
  id: string;
  name: string;
  /** Sketch plane definition */
  plane: SketchPlane;
  /** 2D geometry elements in this sketch */
  elements: SketchElement[];
  /** Reference to the OpenCascade wire/face generated from this sketch */
  geometry?: ShapeReference;
  /** Whether the sketch is closed (can be used for extrude/revolve) */
  isClosed: boolean;
  /** Whether this sketch is visible in the viewport */
  isVisible: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Feature {
  id: string;
  name: string;
  type: FeatureTool;
  /** Reference to source sketch (for sketch-based operations) */
  sketchId?: string;
  /** Operation parameters (distance, angle, radius, etc.) */
  parameters?: OperationParams;
  /** Reference to the OpenCascade shape generated by this feature */
  geometry?: ShapeReference;
  /** Parent feature IDs (for dependency tracking) */
  parentIds: string[];
  /** Whether this feature is currently suppressed (not included in rebuild) */
  isSuppressed: boolean;
  /** Whether this feature is visible in the viewport */
  isVisible: boolean;
  createdAt: number;
  updatedAt: number;
  isExpanded?: boolean;
}

export interface ReferenceGeometry {
  id: string;
  name: string;
  type: 'plane' | 'origin';
}

export interface FeatureTreeItem {
  id: string;
  name: string;
  type: 'reference-geometry' | 'sketch' | 'feature';
  children?: FeatureTreeItem[];
  isExpanded?: boolean;
  visible?: boolean;
  error?: string;
  data?: ReferenceGeometry | Sketch | Feature;
}

export interface CADProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Version number for parametric rebuild tracking */
  version: number;
  referenceGeometry: ReferenceGeometry[];
  sketches: Sketch[];
  features: Feature[];
}

/** Rebuild state tracking */
export interface RebuildState {
  /** Whether a rebuild is currently in progress */
  isRebuilding: boolean;
  /** Current rebuild progress (0-1) */
  progress: number;
  /** Error message if rebuild failed */
  error?: string;
  /** ID of feature currently being rebuilt */
  currentFeatureId?: string;
}

export interface CADState {
  project: CADProject;
  activeTab: ToolCategory;
  activeTool: Tool;
  selectedTreeItem: string | null;
  isSidebarOpen: boolean;
  /** Current rebuild state */
  rebuildState: RebuildState;
  /** Active sketch being edited (if in sketch mode) */
  activeSketchId: string | null;
}

// Default reference geometry that always exists
export const DEFAULT_REFERENCE_GEOMETRY: ReferenceGeometry[] = [
  { id: 'front-plane', name: 'Front Plane', type: 'plane' },
  { id: 'top-plane', name: 'Top Plane', type: 'plane' },
  { id: 'right-plane', name: 'Right Plane', type: 'plane' },
  { id: 'origin', name: 'Origin', type: 'origin' },
];

export const createNewProject = (): CADProject => {
  const now = Date.now();
  const defaultSketchId = crypto.randomUUID();
  const defaultExtrudeId = crypto.randomUUID();

  return {
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    createdAt: now,
    updatedAt: now,
    version: 1,
    referenceGeometry: DEFAULT_REFERENCE_GEOMETRY,
    sketches: [
      {
        id: defaultSketchId,
        name: 'Sketch1',
        plane: {
          type: 'xy',
          planeRef: 'front-plane',
          offset: 0,
        },
        elements: [
          {
            type: 'rectangle',
            corner1: { x: -25, y: -25 },
            corner2: { x: 25, y: 25 },
          } as SketchElement,
        ],
        isClosed: true,
        isVisible: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    features: [
      {
        id: defaultExtrudeId,
        name: 'Boss-Extrude1',
        type: 'extrude-boss',
        sketchId: defaultSketchId,
        parameters: {
          distance: 50,
          direction: { x: 0, y: 0, z: 1 },
          isCut: false,
        } as ExtrudeParams,
        parentIds: [defaultSketchId],
        isSuppressed: false,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
};

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
}