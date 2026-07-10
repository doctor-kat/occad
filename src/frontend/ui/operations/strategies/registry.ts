import { FeatureOperation, type Operation } from '@/cad/types';
import { BoxPanel } from './BoxPanel';
import { FilletPanel } from './FilletPanel';
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
  [FeatureOperation.FILLET]: FilletPanel,
};
