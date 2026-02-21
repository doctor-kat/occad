import { ExtrudeParams } from './ExtrudeParams';
import { RevolveParams } from './RevolveParams';
import { PrimitiveBoxParams } from './PrimitiveBoxParams';
import { PrimitiveSphereParams } from './PrimitiveSphereParams';
import { PrimitiveCylinderParams } from './PrimitiveCylinderParams';
import { PrimitiveConeParams } from './PrimitiveConeParams';
import { PrimitiveTorusParams } from './PrimitiveTorusParams';
import { PrimitiveWedgeParams } from './PrimitiveWedgeParams';
import { BooleanParams } from './BooleanParams';
import { FilletParams } from './FilletParams';
import { ChamferParams } from './ChamferParams';
import { ShellParams } from './ShellParams';
import { OffsetParams } from './OffsetParams';

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
  | OffsetParams;
