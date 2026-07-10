import { create } from 'zustand';
import { OperationCategory } from '@/cad/types';
import type { MeasurementData, MeasureBetweenData, MeasureSelection } from '@/cad/types';

interface CADLayoutUiState {
  activeSidebarTab: string | null;
  setActiveSidebarTab: (tab: string | null) => void;

  operationPanelOpen: boolean;
  setOperationPanelOpen: (open: boolean) => void;
  editingFeatureId: string | null;
  setEditingFeatureId: (id: string | null) => void;

  measurement: MeasurementData | null;
  setMeasurement: (m: MeasurementData | null) => void;
  measurePicks: MeasureSelection[];
  setMeasurePicks: (picks: MeasureSelection[] | ((prev: MeasureSelection[]) => MeasureSelection[])) => void;
  betweenMeasurement: MeasureBetweenData | null;
  setBetweenMeasurement: (m: MeasureBetweenData | null) => void;
}

// Feature-scoped UI state for the CADLayout subtree (sidebar tab, operation-panel
// open/edit state, measurement readouts). Mirrors viewportStore.ts's pattern —
// lets CADSidebar subscribe directly via selectors instead of receiving these as
// props/context, so unrelated re-renders (e.g. CADHeader/CADMainCanvas) don't
// fire when a measurement pick changes.
export const useCadLayoutUiStore = create<CADLayoutUiState>((set) => ({
  activeSidebarTab: OperationCategory.FEATURES,
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  operationPanelOpen: false,
  setOperationPanelOpen: (open) => set({ operationPanelOpen: open }),
  editingFeatureId: null,
  setEditingFeatureId: (id) => set({ editingFeatureId: id }),

  measurement: null,
  setMeasurement: (m) => set({ measurement: m }),
  measurePicks: [],
  setMeasurePicks: (picks) =>
    set((s) => ({ measurePicks: typeof picks === 'function' ? picks(s.measurePicks) : picks })),
  betweenMeasurement: null,
  setBetweenMeasurement: (m) => set({ betweenMeasurement: m }),
}));
