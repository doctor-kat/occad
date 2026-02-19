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
