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

  clearSelection: () => set({
    selectedFaceId: null,
    selectedEdgeIndex: null,
    selectedVertexIndex: null,
  }),

  clearHover: () => set({
    hoveredTreeItem: null,
    hoveredFaceId: null,
    hoveredEdgeIndex: null,
  }),
}));
