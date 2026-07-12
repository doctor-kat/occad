import type { BoxMode } from '@/cad/engine/sketch/sketchBoxSelection';
import type { ContextMenuState } from './ContextMenuState';
import type { CameraCommand } from './CameraCommand';
import type { CameraViewType } from '../viewportStore';
import type { Operation, OperationCategory } from '@/cad/types';

export interface ViewportState {
  // --- Ephemeral UI state -------------------------------------------------
  // Transient, non-persisted interaction state. Lives here (not in the project
  // reducer) so any component can read it without prop-drilling — the same
  // rationale as selectedTreeItem above.

  /** Active operations-bar category tab (Primitives/Sketch/…). */
  activeTab: OperationCategory;
  /** Currently armed operation, or null. Toggling the same op clears it. */
  activeOperation: Operation;
  /** Left sidebar expanded/collapsed. */
  isSidebarOpen: boolean;
  /** Id of the sketch currently being edited (sketch mode), or null. */
  activeSketchId: string | null;
  /** Per-tree-item rebuild error messages, keyed by sketch/feature id. */
  itemErrors: Record<string, string>;

  // Hover state
  hoveredTreeItem: string | null;
  hoveredFaceId: number | null;
  hoveredEdgeIndex: number | null;

  // Selection state
  /** Currently selected feature-tree row (sketch, feature, or reference geometry id). */
  selectedTreeItem: string | null;
  selectedFaceId: number | null;
  selectedEdgeIndex: number | null;
  selectedVertexIndex: number | null;

  /**
   * Additional model edges highlighted alongside `selectedEdgeIndex` — used by
   * "Select Loop" to light up a whole bounding wire. 0-based global edge ids
   * (the scheme `edgeMapping` reports). Empty for ordinary single-edge picks.
   */
  selectedEdgeIndices: number[];

  /** Ids of sketch elements selected in sketch mode (for applying constraints). */
  selectedSketchElementIds: string[];

  /** Sketch element currently hovered (from viewport OR the sidebar entity list). */
  hoveredSketchElementId: string | null;

  /** Sketch constraint currently selected (via its viewport icon or list row). */
  selectedConstraintId: string | null;

  /** Sketch constraint currently hovered (via its viewport icon or list row). */
  hoveredConstraintId: string | null;

  /**
   * Live rubber-band rectangle for sketch box-select, in canvas-local CSS px.
   * `mode` is 'window' (drag right → fully enclosed) or 'crossing' (drag left →
   * touching). Null when no drag is in progress. Drawn as a DOM overlay over the
   * canvas by OpenCascadeViewport.
   */
  sketchSelectionBox: { x: number; y: number; w: number; h: number; mode: BoxMode } | null;

  /** Open viewport right-click context menu, or null when closed. */
  contextMenu: ContextMenuState | null;

  /** Latest one-shot camera framing request (consumed by CameraController). */
  cameraCommand: CameraCommand | null;

  // Sketch-on-face pending state
  pendingSketchOnFace: number | null;

  // Extrude preview state
  extrudePreview: {
    sketchId: string | null;
    distance: number;
    direction: 'normal' | 'reverse';
  } | null;

  // Actions
  setHoveredTreeItem: (id: string | null) => void;
  setHoveredFaceId: (id: number | null) => void;
  setHoveredEdgeIndex: (id: number | null) => void;
  setSelectedTreeItem: (id: string | null) => void;
  /** Selects `id`, or clears the selection if it's already selected. */
  toggleSelectedTreeItem: (id: string | null) => void;
  setSelectedFaceId: (id: number | null) => void;
  setSelectedEdgeIndex: (id: number | null) => void;
  setSelectedEdgeIndices: (ids: number[]) => void;
  setSelectedVertexIndex: (id: number | null) => void;
  setPendingSketchOnFace: (id: number | null) => void;
  setExtrudePreview: (preview: { sketchId: string | null; distance: number; direction: 'normal' | 'reverse' } | null) => void;
  /** Toggle a sketch element's membership in the selection set. */
  toggleSketchElementSelection: (id: string) => void;
  setSketchElementSelection: (ids: string[]) => void;
  clearSketchSelection: () => void;
  setHoveredSketchElementId: (id: string | null) => void;
  setSketchSelectionBox: (box: ViewportState['sketchSelectionBox']) => void;
  setSelectedConstraintId: (id: string | null) => void;
  setHoveredConstraintId: (id: string | null) => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  requestCameraView: (view: CameraViewType) => void;
  clearSelection: () => void;
  clearHover: () => void;

  // --- Ephemeral UI actions -----------------------------------------------
  /** Set the category tab without touching the active operation. */
  setActiveTab: (tab: OperationCategory) => void;
  /** Switch category tab; also disarms any active operation. */
  switchTab: (tab: OperationCategory) => void;
  /** Arm `operation`, or disarm if it's already the active one. */
  selectOperation: (operation: Operation) => void;
  setActiveOperation: (operation: Operation) => void;
  toggleSidebar: () => void;
  setActiveSketchId: (id: string | null) => void;
  setItemError: (itemId: string, message: string) => void;
  clearAllItemErrors: () => void;
}
