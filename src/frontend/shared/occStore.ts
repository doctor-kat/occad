import { create } from 'zustand';
import type { MeshData as CADMeshData, SketchEdgeData } from '@/cad/types';

export type { CADMeshData as MeshData };

export type OCCStatus = 'loading' | 'ready' | 'building' | 'error';

interface OCCState {
  status: OCCStatus;
  progress: string;
  error: string | null;
  mesh: CADMeshData | null;
  currentShapeId: string | null;
  currentFeatureShapeId: string | null;
  sketchEdges: Record<string, SketchEdgeData> | null;

  setStatus: (status: OCCStatus) => void;
  setProgress: (progress: string) => void;
  setError: (error: string | null) => void;
  setMesh: (mesh: CADMeshData | null) => void;
  setCurrentShapeId: (shapeId: string | null) => void;
  setCurrentFeatureShapeId: (shapeId: string | null) => void;
  setSketchEdges: (sketchEdges: Record<string, SketchEdgeData> | null) => void;
  clearMesh: () => void;
}

export const useOccStore = create<OCCState>((set) => ({
  status: 'loading',
  progress: 'Initialising…',
  error: null,
  mesh: null,
  currentShapeId: null,
  currentFeatureShapeId: null,
  sketchEdges: null,

  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  setMesh: (mesh) => set({ mesh }),
  setCurrentShapeId: (currentShapeId) => set({ currentShapeId }),
  setCurrentFeatureShapeId: (currentFeatureShapeId) => set({ currentFeatureShapeId }),
  setSketchEdges: (sketchEdges) => set({ sketchEdges }),
  clearMesh: () => set({
    mesh: null,
    currentShapeId: null,
    currentFeatureShapeId: null,
    sketchEdges: null,
  }),
}));

// Expose the store for debugging and e2e, mirroring viewportStore's __viewportStore hook.
if (typeof window !== 'undefined') {
  (window as any).__occStore = useOccStore;
}
