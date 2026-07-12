import { create } from 'zustand';
import type { ViewportState } from './viewport/ViewportState';
import { OperationCategory } from '@/cad/types';

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

/** Shift/Ctrl/Cmd-click multi-selects (toggle); a plain click replaces the selection. */
export function isMultiSelectClick(e: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): boolean {
  return Boolean(e.shiftKey || e.ctrlKey || e.metaKey);
}

export const useViewportStore = create<ViewportState>((set) => ({
  // Initial state
  activeTab: OperationCategory.PRIMITIVES,
  activeOperation: null,
  isSidebarOpen: true,
  activeSketchId: null,
  itemErrors: {},
  hoveredTreeItem: null,
  hoveredFaceId: null,
  hoveredEdgeIndex: null,
  selectedTreeItem: null,
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
  setSelectedTreeItem: (id) => set({ selectedTreeItem: id }),
  toggleSelectedTreeItem: (id) => set((state) => ({ selectedTreeItem: state.selectedTreeItem === id ? null : id })),
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

  // Ephemeral UI actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  switchTab: (tab) => set({ activeTab: tab, activeOperation: null }),
  selectOperation: (operation) =>
    set((state) => ({ activeOperation: state.activeOperation === operation ? null : operation })),
  setActiveOperation: (operation) => set({ activeOperation: operation }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setActiveSketchId: (id) => set({ activeSketchId: id }),
  setItemError: (itemId, message) =>
    set((state) => ({ itemErrors: { ...state.itemErrors, [itemId]: message } })),
  clearAllItemErrors: () => set({ itemErrors: {} }),
}));

// Expose the store for debugging and e2e (lets tests drive sketch selection
// deterministically, mirroring what canvas clicks do).
if (typeof window !== 'undefined') {
  (window as any).__viewportStore = useViewportStore;
}
