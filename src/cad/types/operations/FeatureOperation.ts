export enum FeatureOperation {
  // Boss/Base operations
  EXTRUDE_BOSS = 'extrude-boss',
  REVOLVED_BOSS = 'revolved-boss',
  // Cut operations
  EXTRUDED_CUT = 'extruded-cut',
  REVOLVED_CUT = 'revolved-cut',
  // Primitives
  BOX = 'box',
  SPHERE = 'sphere',
  CYLINDER = 'cylinder',
  CONE = 'cone',
  TORUS = 'torus',
  WEDGE = 'wedge',
  // 3D Operations
  SWEEP = 'sweep',
  LOFT = 'loft',
  // Boolean Operations
  UNION = 'union',
  INTERSECT = 'intersect',
  // Modifications
  FILLET = 'fillet',
  CHAMFER = 'chamfer',
  SHELL = 'shell',
  OFFSET = 'offset',
  // Transformations
  MOVE = 'move',
  ROTATE = 'rotate',
  MIRROR = 'mirror',
  SCALE = 'scale',
  // Evaluation
  MEASURE = 'measure',
  // Import (imported solid, no parametric history)
  IMPORT = 'import'
}
