/** The sketch constraints this app can apply. This enum is the capability list. */
export enum ConstraintKind {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
  Coincident = 'coincident',
  Parallel = 'parallel',
  Perpendicular = 'perpendicular',
  Distance = 'distance',
  HorizontalDistance = 'horizontal-distance',
  VerticalDistance = 'vertical-distance',
  PointLineDistance = 'point-line-distance',
  Radius = 'radius',
  Equal = 'equal',
  Tangent = 'tangent',
  Angle = 'angle',
  Midpoint = 'midpoint',
}
