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
  | ChamferParams;
