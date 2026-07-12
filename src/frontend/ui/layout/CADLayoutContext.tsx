import { createContext, useContext, type RefObject } from 'react';
import type { MantineTheme } from '@mantine/core';
import type {
  CADProject,
  ExportFormat,
  MeasureSelection,
  Measurement,
  ExtrudeParams,
  RevolveParams,
  Sketch,
  SketchEdgeData,
  StableRef,
  SubShapeKind,
  TessellationLevel,
  TessellationQuality,
} from '@/cad/types';
import type { OCCStatus, MeshData } from '@/frontend/shared/occStore';
import type { useMeasurement } from './hooks/useMeasurement';
import type { useSketchEditing } from './hooks/useSketchEditing';
import type { useSketchPlaneSelection } from './hooks/useSketchPlaneSelection';
import type { useViewportSelection } from './hooks/useViewportSelection';
import type { useProjectIO } from './hooks/useProjectIO';
import type { useOperationPanel } from './hooks/useOperationPanel';

// Distributes the per-render handler bags CADLayout.tsx assembles once (the OCC
// bridge and the orchestrated sub-hooks) to CADHeader/CADSidebar/CADMainCanvas
// without prop drilling. Durable project state lives in projectStore (read via
// useProjectState selectors / mutated via projectApi) and ephemeral UI state in
// viewportStore / cadLayoutUiStore, so none of that is here — components that
// need it subscribe to those stores directly.
/** Shape of the `occ` context field — worker-output state (from occStore) plus
 * imperative ops/wrappers (from occWorkerClient), assembled once in CADLayout.tsx. */
export interface OccBridgeValue {
  occStatus: OCCStatus;
  occProgress: string;
  occError: string | null;
  occMesh: MeshData | null;
  occRetry: () => void;
  occSketchEdges: Record<string, SketchEdgeData> | null;
  rebuild: (project: CADProject, tessellation?: TessellationQuality) => void;
  clearMesh: () => void;
  extrudeSketch: (featureId: string, sketchId: string, params: ExtrudeParams) => void;
  getFaceGeometry: (faceId: number, shapeId: string) => void;
  getEdgeLoop: (requestId: string, shapeId: string, edgeIndex: number) => Promise<void>;
  measureShape: (requestId: string, shapeId: string) => Promise<Measurement>;
  measureBetween: (requestId: string, shapeId: string, a: MeasureSelection, b: MeasureSelection) => Promise<Measurement>;
  currentFeatureShapeId: string | null;
  buildSketch: (sketch: Sketch) => void;
  resolveSelectorAsync: (kind: SubShapeKind, selector: string) => Promise<StableRef[]>;
  exportShape: (requestId: string, shapeId: string, format: ExportFormat, fileName: string) => Promise<void>;
}

export interface CADLayoutContextValue {
  theme: MantineTheme;
  headerRef: RefObject<HTMLDivElement>;
  headerHeight: number;
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
  occ: OccBridgeValue;
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
