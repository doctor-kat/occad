import {
  HorizontalConstraintInput,
  VerticalConstraintInput,
  CoincidentConstraintInput,
  ParallelConstraintInput,
  PerpendicularConstraintInput,
  DistanceConstraintInput,
  HorizontalDistanceConstraintInput,
  VerticalDistanceConstraintInput,
  PointLineDistanceConstraintInput,
  RadiusConstraintInput,
  EqualConstraintInput,
  TangentConstraintInput,
  AngleConstraintInput,
  MidpointConstraintInput,
} from './inputs';

/** Discriminated input describing which entities a constraint applies to. */
export type ConstraintInput =
  | HorizontalConstraintInput
  | VerticalConstraintInput
  | CoincidentConstraintInput
  | ParallelConstraintInput
  | PerpendicularConstraintInput
  | DistanceConstraintInput
  | HorizontalDistanceConstraintInput
  | VerticalDistanceConstraintInput
  | PointLineDistanceConstraintInput
  | RadiusConstraintInput
  | EqualConstraintInput
  | TangentConstraintInput
  | AngleConstraintInput
  | MidpointConstraintInput;
