import { ExtrudeParams, RevolveParams, SweepParams, LoftParams } from './sketchFeatureParams';
import {
  PrimitiveBoxParams,
  PrimitiveSphereParams,
  PrimitiveCylinderParams,
  PrimitiveConeParams,
  PrimitiveTorusParams,
  PrimitiveWedgeParams,
} from './primitiveParams';
import { FilletParams, ChamferParams, ShellParams, OffsetParams } from './modificationParams';
import { TransformParams } from './TransformParams';
import { MeasureParams } from './measureTypes';
import { ImportParams } from './ioTypes';

export interface BooleanParams {
  /** IDs of features to combine */
  featureIds: string[];
  /** Operation type */
  operation: 'union' | 'intersect' | 'subtract';
}

export type OperationParams =
  | ExtrudeParams
  | RevolveParams
  | PrimitiveBoxParams
  | PrimitiveSphereParams
  | PrimitiveCylinderParams
  | PrimitiveConeParams
  | PrimitiveTorusParams
  | PrimitiveWedgeParams
  | BooleanParams
  | FilletParams
  | ChamferParams
  | ShellParams
  | OffsetParams
  | SweepParams
  | LoftParams
  | TransformParams
  | MeasureParams
  | ImportParams;
