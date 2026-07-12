import type { FC } from 'react';
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

/** The panel's current complete params, reported to the shell via `onChange`. */
export interface PanelDraft {
  params: OperationParams;
  sketchId?: string;
}

/**
 * Props every operation-panel Strategy component receives. Each Strategy owns
 * its own local state (lazy-initialized from `initialParams`/`ctx`) and is
 * responsible for its own field rendering and validation — the shell
 * (`OperationPanel`) only renders it and drives Apply/Cancel through a
 * push-based contract: the Strategy calls `onChange` with a `PanelDraft`
 * whenever its internal state produces a complete, valid set of params, or
 * with `null` while invalid/incomplete. There is no imperative handle; the
 * shell never reaches into the Strategy to pull state out.
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
  /** Report the panel's current complete params (or null while invalid) whenever internal state changes. */
  onChange: (draft: PanelDraft | null) => void;
}

export type OperationPanelComponent = FC<OperationPanelProps>;
