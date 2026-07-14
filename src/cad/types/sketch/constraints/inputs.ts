/**
 * The entity-reference shape for each sketch constraint, one interface per kind.
 * Grouped module (mirrors `sketchElements.ts`): scan every constraint's inputs here;
 * the union barrel is `ConstraintInput.ts`. Discriminant `kind` uses string literals
 * (matching `ConstraintKind` values) since constraints are constructed as object literals.
 */

export interface HorizontalConstraintInput {
  kind: 'horizontal';
  lineId: string;
}

export interface VerticalConstraintInput {
  kind: 'vertical';
  lineId: string;
}

export interface CoincidentConstraintInput {
  kind: 'coincident';
  p1Id: string;
  p2Id: string;
}

export interface ParallelConstraintInput {
  kind: 'parallel';
  l1Id: string;
  l2Id: string;
}

export interface PerpendicularConstraintInput {
  kind: 'perpendicular';
  l1Id: string;
  l2Id: string;
}

export interface DistanceConstraintInput {
  kind: 'distance';
  p1Id: string;
  p2Id: string;
  distance: number;
}

export interface HorizontalDistanceConstraintInput {
  kind: 'horizontal-distance';
  p1Id: string;
  p2Id: string;
  distance: number;
}

export interface VerticalDistanceConstraintInput {
  kind: 'vertical-distance';
  p1Id: string;
  p2Id: string;
  distance: number;
}

export interface PointLineDistanceConstraintInput {
  kind: 'point-line-distance';
  pointId: string;
  lineId: string;
  distance: number;
}

export interface RadiusConstraintInput {
  kind: 'radius';
  targetId: string;
  radius: number;
  isArc?: boolean;
}

export interface EqualConstraintInput {
  kind: 'equal';
  l1Id: string;
  l2Id: string;
}

export interface TangentConstraintInput {
  kind: 'tangent';
  lineId: string;
  circleId: string;
}

export interface AngleConstraintInput {
  kind: 'angle';
  l1Id: string;
  l2Id: string;
  angle: number;
}

/**
 * Point `midId` is the midpoint of the segment between endpoints `p1Id`/`p2Id`
 * (the two endpoints are symmetric about it). See createConstraint.
 */
export interface MidpointConstraintInput {
  kind: 'midpoint';
  p1Id: string;
  p2Id: string;
  midId: string;
}
