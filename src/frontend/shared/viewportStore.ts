import { create } from 'zustand';
import type { BoxMode } from '@/cad/engine/sketch/sketchBoxSelection';

/**
 * What a viewport right-click resolved to. Drives which context menu is shown
 * (see ViewportContextMenu). Resolved from the entity under the cursor at
 * right-click time, or — on empty space — from the current selection, so
 * "right-click nothing with a selection" behaves like right-clicking the
 * selected item. Empty space with no selection resolves to `camera`.
 * (Lives here, in the shared layer, so the store doesn't depend on the canvas
 * layer; the resolution logic in canvas/contextMenu imports this type.)
 */
export type ContextTarget =
  | { kind: 'face'; faceId: number }
  | { kind: 'edge'; edgeIndex: number }
  | { kind: 'sketch-entity'; elementId: string }
  | { kind: 'camera' };

/** Standard camera framings offered by the empty-space context menu. */
export enum CameraViewType {
  Fit = 'fit',
  Front = 'front',
  Back = 'back',
  Top = 'top',
  Bottom = 'bottom',
  Right = 'right',
  Left = 'left',
  Iso = 'iso',
}

/** An open viewport right-click menu: cursor position (client px) + what was hit. */
export interface ContextMenuState {
  x: number;
  y: number;
  target: ContextTarget;
}

/** A one-shot camera framing request; `nonce` makes each request distinct so the
 *  in-Canvas CameraController re-runs even when the same view is picked twice. */
export interface CameraCommand {
  view: CameraViewType;
  nonce: number;
}

interface ViewportState {
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

/** Shift/Ctrl/Cmd-click multi-selects (toggle); a plain click replaces the selection. */
export function isMultiSelectClick(e: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): boolean {
  return Boolean(e.shiftKey || e.ctrlKey || e.metaKey);
}

export const useViewportStore = create<ViewportState>((set) => ({
  // Initial state
  hoveredTreeItem: null,
  hoveredFaceId: null,
  hoveredEdgeIndex: null,
  selectedFaceId: null,
  selectedEdgeIndex: null,
  selectedVertexIndex: null,
  selectedEdgeIndices: [],
  selectedSketchElementIds: [],
  hoveredSketchElementId: null,
  selectedConstraintId: null,
  hoveredConstraintId: null,
  sketchSelectionBox: null,
  contextMenu: null,
  cameraCommand: null,
  pendingSketchOnFace: null,
  extrudePreview: null,

  // Actions
  setHoveredTreeItem: (id) => set({ hoveredTreeItem: id }),
  setHoveredFaceId: (id) => set({ hoveredFaceId: id }),
  setHoveredEdgeIndex: (id) => set({ hoveredEdgeIndex: id }),
  setSelectedFaceId: (id) => set({ selectedFaceId: id }),
  // A fresh single-edge pick drops any prior loop highlight.
  setSelectedEdgeIndex: (id) => set({ selectedEdgeIndex: id, selectedEdgeIndices: [] }),
  setSelectedEdgeIndices: (ids) => set({ selectedEdgeIndices: ids }),
  setSelectedVertexIndex: (id) => set({ selectedVertexIndex: id }),
  setPendingSketchOnFace: (id) => set({ pendingSketchOnFace: id }),
  setExtrudePreview: (preview) => set({ extrudePreview: preview }),

  toggleSketchElementSelection: (id) => set((state) => ({
    selectedSketchElementIds: state.selectedSketchElementIds.includes(id)
      ? state.selectedSketchElementIds.filter((x) => x !== id)
      : [...state.selectedSketchElementIds, id],
  })),
  setSketchElementSelection: (ids) => set({ selectedSketchElementIds: ids }),
  clearSketchSelection: () => set({ selectedSketchElementIds: [], selectedConstraintId: null, hoveredConstraintId: null }),
  setHoveredSketchElementId: (id) => set({ hoveredSketchElementId: id }),
  setSketchSelectionBox: (box) => set({ sketchSelectionBox: box }),
  setSelectedConstraintId: (id) => set({ selectedConstraintId: id }),
  setHoveredConstraintId: (id) => set({ hoveredConstraintId: id }),

  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
  requestCameraView: (view) => set({ cameraCommand: { view, nonce: Date.now() } }),

  clearSelection: () => set({
    selectedFaceId: null,
    selectedEdgeIndex: null,
    selectedEdgeIndices: [],
    selectedVertexIndex: null,
    selectedSketchElementIds: [],
    hoveredSketchElementId: null,
    selectedConstraintId: null,
    hoveredConstraintId: null,
  }),

  clearHover: () => set({
    hoveredTreeItem: null,
    hoveredFaceId: null,
    hoveredEdgeIndex: null,
  }),
}));

// Expose the store for debugging and e2e (lets tests drive sketch selection
// deterministically, mirroring what canvas clicks do).
if (typeof window !== 'undefined') {
  (window as any).__viewportStore = useViewportStore;
}
