export type ConstraintKind =
  | 'horizontal'
  | 'vertical'
  | 'coincident'
  | 'parallel'
  | 'perpendicular'
  | 'distance'
  | 'horizontal-distance'
  | 'vertical-distance'
  | 'point-line-distance'
  | 'radius'
  | 'equal'
  | 'tangent'
  | 'angle'
  | 'midpoint';

/** Discriminated input describing which entities a constraint applies to. */
export type ConstraintInput =
  | { kind: 'horizontal'; lineId: string }
  | { kind: 'vertical'; lineId: string }
  | { kind: 'coincident'; p1Id: string; p2Id: string }
  | { kind: 'parallel'; l1Id: string; l2Id: string }
  | { kind: 'perpendicular'; l1Id: string; l2Id: string }
  | { kind: 'distance'; p1Id: string; p2Id: string; distance: number }
  | { kind: 'horizontal-distance'; p1Id: string; p2Id: string; distance: number }
  | { kind: 'vertical-distance'; p1Id: string; p2Id: string; distance: number }
  | { kind: 'point-line-distance'; pointId: string; lineId: string; distance: number }
  | { kind: 'radius'; targetId: string; radius: number; isArc?: boolean }
  | { kind: 'equal'; l1Id: string; l2Id: string }
  | { kind: 'tangent'; lineId: string; circleId: string }
  | { kind: 'angle'; l1Id: string; l2Id: string; angle: number }
  // Point `midId` is the midpoint of the segment between endpoints `p1Id`/`p2Id`
  // (the two endpoints are symmetric about it). See createConstraint.
  | { kind: 'midpoint'; p1Id: string; p2Id: string; midId: string };
