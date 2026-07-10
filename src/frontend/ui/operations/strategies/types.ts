import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type {
  CADProject,
  FeatureOperation,
  OperationParams,
  StableRef,
  SubShapeKind,
  SketchOperation,
  TransformOperation,
} from '@/cad/types';

/** Live viewport selection, passed down so a panel can seed/append from clicks. */
export interface SelectionContext {
  selectedFaceId: number | null;
  selectedEdgeIndex: number | null;
  selectedVertexIndex: number | null;
  selectedTreeItem?: string | null;
}

/**
 * Props every operation-panel Strategy component receives. Each Strategy owns
 * its own local state (lazy-initialized from `initialParams`/`ctx`) and is
 * responsible for its own field rendering, validation, and params construction
 * — the shell (`OperationPanel`) only renders it and drives Apply/Cancel
 * through the imperative handle below.
 */
export interface OperationPanelProps {
  /** Exact enum variant being rendered — needed by Strategies that serve more than one
   *  variant (e.g. ExtrudePanel handles both EXTRUDE_BOSS and EXTRUDED_CUT). */
  operation: FeatureOperation | TransformOperation | SketchOperation;
  project: CADProject;
  ctx: SelectionContext;
  initialParams?: OperationParams;
  initialSketchId?: string;
  onResolveSelector?: (kind: SubShapeKind, selector: string) => Promise<StableRef[]>;
  onConfirm: (params: OperationParams, sketchId?: string) => void;
  /** Called whenever the panel's internal validity changes, so the shell can enable/disable Apply. */
  onValidChange: (valid: boolean) => void;
}

export interface OperationPanelHandle {
  /** Builds params from current internal state and calls onConfirm. No-op if invalid. */
  submit: () => void;
}

export type OperationPanelComponent = ForwardRefExoticComponent<
  OperationPanelProps & RefAttributes<OperationPanelHandle>
>;
