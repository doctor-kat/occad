import { createContext, useContext, type RefObject } from 'react';
import type { MantineTheme } from '@mantine/core';
import type { Sketch, TessellationLevel } from '@/cad/types';
import type { useCADState } from '@/frontend/shared/useCADState';
import type { useOpenCascadeBridge } from './hooks/useOpenCascadeBridge';
import type { useMeasurement } from './hooks/useMeasurement';
import type { useSketchEditing } from './hooks/useSketchEditing';
import type { useSketchPlaneSelection } from './hooks/useSketchPlaneSelection';
import type { useViewportSelection } from './hooks/useViewportSelection';
import type { useProjectIO } from './hooks/useProjectIO';
import type { useOperationPanel } from './hooks/useOperationPanel';

// Distributes the singleton-hook data and handler bags CADLayout.tsx already
// computes once (useCADState/useOpenCascade must each only be instantiated
// once — see CLAUDE.md) to CADHeader/CADSidebar/CADMainCanvas without prop
// drilling. Plain UI state (sidebar tab, measurement, operation-panel
// open/edit) lives in cadLayoutUiStore.ts (Zustand) instead, so it isn't here —
// components that need it subscribe to that store directly.
export interface CADLayoutContextValue {
  theme: MantineTheme;
  headerRef: RefObject<HTMLDivElement>;
  headerHeight: number;
  cadState: ReturnType<typeof useCADState>;
  activeSketch: Sketch | undefined;
  viewportSelection2D: {
    selectedFaceId: number | null;
    selectedEdgeIndex: number | null;
    selectedVertexIndex: number | null;
    setSelectedFaceId: (id: number | null) => void;
    setSelectedEdgeIndex: (id: number | null) => void;
    setSelectedVertexIndex: (id: number | null) => void;
  };
  tessellationLevel: TessellationLevel;
  setTessellationLevel: (level: TessellationLevel) => void;
  occ: ReturnType<typeof useOpenCascadeBridge>;
  measurement: ReturnType<typeof useMeasurement>;
  sketchEditing: ReturnType<typeof useSketchEditing>;
  sketchPlaneSelection: ReturnType<typeof useSketchPlaneSelection>;
  viewportSelection: ReturnType<typeof useViewportSelection>;
  projectIO: ReturnType<typeof useProjectIO>;
  operationPanel: ReturnType<typeof useOperationPanel>;
  onSelectTreeItem: (id: string) => void;
  onPlaneClick: (planeId: string) => void;
  onSketchClick: (sketchId: string) => void;
}

const CADLayoutContext = createContext<CADLayoutContextValue | null>(null);

export function useCADLayoutContext(): CADLayoutContextValue {
  const ctx = useContext(CADLayoutContext);
  if (!ctx) throw new Error('useCADLayoutContext must be used within CADLayoutProvider');
  return ctx;
}

export const CADLayoutProvider = CADLayoutContext.Provider;
