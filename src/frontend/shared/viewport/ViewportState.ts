import type { BoxMode } from '@/cad/engine/sketch/sketchBoxSelection';
import type { ContextMenuState } from './ContextMenuState';
import type { CameraCommand } from './CameraCommand';
import type { CameraViewType } from '../viewportStore';

export interface ViewportState {
  // Hover state
  hoveredTreeItem: string | null;
  hoveredFaceId: number | null;
  hoveredEdgeIndex: number | null;

  // Selection state
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
}
