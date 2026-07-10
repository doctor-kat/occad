import { FeatureOperation, TransformOperation, type Operation } from '@/cad/types';
import { BoxPanel } from './BoxPanel';
import { SpherePanel } from './SpherePanel';
import { CylinderPanel } from './CylinderPanel';
import { ConePanel } from './ConePanel';
import { TorusPanel } from './TorusPanel';
import { WedgePanel } from './WedgePanel';
import { FilletPanel } from './FilletPanel';
import { ChamferPanel } from './ChamferPanel';
import { ShellPanel } from './ShellPanel';
import { OffsetPanel } from './OffsetPanel';
import { ExtrudePanel } from './ExtrudePanel';
import { RevolvePanel } from './RevolvePanel';
import { SweepPanel } from './SweepPanel';
import { LoftPanel } from './LoftPanel';
import { BooleanPanel } from './BooleanPanel';
import { MovePanel } from './MovePanel';
import { RotatePanel } from './RotatePanel';
import { MirrorPanel } from './MirrorPanel';
import { ScalePanel } from './ScalePanel';
import { MeasurePanel } from './MeasurePanel';
import type { OperationPanelComponent } from './types';

/**
 * Registry-factory: maps an operation to its self-contained Strategy
 * component. Operations not yet migrated off the legacy switch-based
 * OperationPanel simply have no entry here — `OperationPanel` falls back to
 * its inline rendering for anything missing from this map. As operations
 * migrate, add one line here (no change needed to the shell).
 */
export const OPERATION_PANEL_REGISTRY: Partial<Record<Operation, OperationPanelComponent>> = {
  [FeatureOperation.BOX]: BoxPanel,
  [FeatureOperation.SPHERE]: SpherePanel,
  [FeatureOperation.CYLINDER]: CylinderPanel,
  [FeatureOperation.CONE]: ConePanel,
  [FeatureOperation.TORUS]: TorusPanel,
  [FeatureOperation.WEDGE]: WedgePanel,
  [FeatureOperation.FILLET]: FilletPanel,
  [FeatureOperation.CHAMFER]: ChamferPanel,
  [FeatureOperation.SHELL]: ShellPanel,
  [FeatureOperation.OFFSET]: OffsetPanel,
  [FeatureOperation.EXTRUDE_BOSS]: ExtrudePanel,
  [FeatureOperation.EXTRUDED_CUT]: ExtrudePanel,
  [FeatureOperation.REVOLVED_BOSS]: RevolvePanel,
  [FeatureOperation.REVOLVED_CUT]: RevolvePanel,
  [FeatureOperation.SWEEP]: SweepPanel,
  [FeatureOperation.LOFT]: LoftPanel,
  [FeatureOperation.UNION]: BooleanPanel,
  [FeatureOperation.INTERSECT]: BooleanPanel,
  [FeatureOperation.MEASURE]: MeasurePanel,
  [TransformOperation.MOVE]: MovePanel,
  [TransformOperation.ROTATE]: RotatePanel,
  [TransformOperation.MIRROR]: MirrorPanel,
  [TransformOperation.SCALE]: ScalePanel,
};
