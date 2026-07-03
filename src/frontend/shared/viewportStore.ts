import { create } from 'zustand';

interface ViewportState {
  // Hover state
  hoveredTreeItem: string | null;
  hoveredFaceId: number | null;
  hoveredEdgeIndex: number | null;

  // Selection state
  selectedFaceId: number | null;
  selectedEdgeIndex: number | null;
  selectedVertexIndex: number | null;

  /** Ids of sketch elements selected in sketch mode (for applying constraints). */
  selectedSketchElementIds: string[];

  /** Sketch element currently hovered (from viewport OR the sidebar entity list). */
  hoveredSketchElementId: string | null;

  /** Sketch constraint currently selected (via its viewport icon or list row). */
  selectedConstraintId: string | null;

  /**
   * Live rubber-band rectangle for sketch box-select, in canvas-local CSS px.
   * `mode` is 'window' (drag right → fully enclosed) or 'crossing' (drag left →
   * touching). Null when no drag is in progress. Drawn as a DOM overlay over the
   * canvas by OpenCascadeViewport.
   */
  sketchSelectionBox: { x: number; y: number; w: number; h: number; mode: 'window' | 'crossing' } | null;

  /**
   * True while a dimension label (or its arrowhead) is being pointer-dragged in
   * `SketchRenderer`. `SketchOverlay`'s box-select pointerdown listener is a raw
   * `addEventListener` on the canvas — it fires regardless of which mesh the r3f
   * event system dispatched to, so it can't tell a label drag from empty-space box
   * select on its own. It checks this flag (via `getState()`, not a subscription)
   * and bails out early when it's set.
   */
  draggingDimensionLabel: boolean;

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
  setDraggingDimensionLabel: (dragging: boolean) => void;
  clearSelection: () => void;
  clearHover: () => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  // Initial state
  hoveredTreeItem: null,
  hoveredFaceId: null,
  hoveredEdgeIndex: null,
  selectedFaceId: null,
  selectedEdgeIndex: null,
  selectedVertexIndex: null,
  selectedSketchElementIds: [],
  hoveredSketchElementId: null,
  selectedConstraintId: null,
  sketchSelectionBox: null,
  draggingDimensionLabel: false,
  pendingSketchOnFace: null,
  extrudePreview: null,

  // Actions
  setHoveredTreeItem: (id) => set({ hoveredTreeItem: id }),
  setHoveredFaceId: (id) => set({ hoveredFaceId: id }),
  setHoveredEdgeIndex: (id) => set({ hoveredEdgeIndex: id }),
  setSelectedFaceId: (id) => set({ selectedFaceId: id }),
  setSelectedEdgeIndex: (id) => set({ selectedEdgeIndex: id }),
  setSelectedVertexIndex: (id) => set({ selectedVertexIndex: id }),
  setPendingSketchOnFace: (id) => set({ pendingSketchOnFace: id }),
  setExtrudePreview: (preview) => set({ extrudePreview: preview }),

  toggleSketchElementSelection: (id) => set((state) => ({
    selectedSketchElementIds: state.selectedSketchElementIds.includes(id)
      ? state.selectedSketchElementIds.filter((x) => x !== id)
      : [...state.selectedSketchElementIds, id],
  })),
  setSketchElementSelection: (ids) => set({ selectedSketchElementIds: ids }),
  clearSketchSelection: () => set({ selectedSketchElementIds: [], selectedConstraintId: null }),
  setHoveredSketchElementId: (id) => set({ hoveredSketchElementId: id }),
  setSketchSelectionBox: (box) => set({ sketchSelectionBox: box }),
  setSelectedConstraintId: (id) => set({ selectedConstraintId: id }),
  setDraggingDimensionLabel: (dragging) => set({ draggingDimensionLabel: dragging }),

  clearSelection: () => set({
    selectedFaceId: null,
    selectedEdgeIndex: null,
    selectedVertexIndex: null,
    selectedSketchElementIds: [],
    hoveredSketchElementId: null,
    selectedConstraintId: null,
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
