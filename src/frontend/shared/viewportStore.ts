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
  clearSketchSelection: () => set({ selectedSketchElementIds: [] }),

  clearSelection: () => set({
    selectedFaceId: null,
    selectedEdgeIndex: null,
    selectedVertexIndex: null,
    selectedSketchElementIds: [],
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
