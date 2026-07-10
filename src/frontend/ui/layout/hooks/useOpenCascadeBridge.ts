import { useCallback, useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { useOpenCascade } from '@/worker/bridge/useOpenCascade';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { syncElementsFromPrimitives } from '@/cad/engine/sketch/syncElementsFromPrimitives';
import { resolveTessellationQuality } from '@/cad/types';
import type {
  CADProject,
  Sketch,
  SketchPlane,
  StableRef,
  SubShapeKind,
  ExportFormat,
  TessellationLevel,
  FeatureRefEnrichment,
  SketchRefEnrichment,
} from '@/cad/types';
import { PlaneType, EXPORT_EXTENSIONS } from '@/cad/types';

interface UseOpenCascadeBridgeArgs {
  project: CADProject;
  tessellationLevel: TessellationLevel;
  addSketch: (name: string, plane: SketchPlane) => Sketch;
  startSketchEdit: (sketchId: string) => void;
  selectTreeItem: (id: string | null) => void;
  updateSketchState: (sketchId: string, sketch: Sketch) => void;
  applyRefEnrichments: (enrichments: FeatureRefEnrichment[]) => void;
  applySketchRefEnrichments: (enrichments: SketchRefEnrichment[]) => void;
  setItemError: (id: string, message: string) => void;
  clearAllItemErrors: () => void;
}

// Single consolidated OpenCascade worker instance — shared by layout & viewport.
// Owns the useOpenCascade(...) call, its callbacks, the rebuild-on-version-change /
// tessellation-change / clear-mesh-on-project-change effects, and the
// resolveSelector + export-with-filename promise/tracking wrappers.
export function useOpenCascadeBridge({
  project,
  tessellationLevel,
  addSketch,
  startSketchEdit,
  selectTreeItem,
  updateSketchState,
  applyRefEnrichments,
  applySketchRefEnrichments,
  setItemError,
  clearAllItemErrors,
}: UseOpenCascadeBridgeArgs) {
  const pendingSketchOnFace = useViewportStore((state) => state.pendingSketchOnFace);
  const setPendingSketchOnFace = useViewportStore((state) => state.setPendingSketchOnFace);

  // Resolves to the pending Promise for each in-flight resolveSelector request
  // (see onSelectorResolved below / resolveSelectorAsync).
  const pendingSelectorResolutions = useRef(new Map<string, (refs: StableRef[]) => void>());

  // Export request → suggested download filename, keyed by requestId (resolved
  // in onExported below).
  const pendingExports = useRef(new Map<string, string>());

  const {
    status: occStatus,
    progress: occProgress,
    error: occError,
    mesh: occMesh,
    retry: occRetry,
    rebuild,
    clearMesh,
    extrudeSketch,
    getFaceGeometry,
    getEdgeLoop,
    resolveSelector,
    exportShape: rawExportShape,
    measureShape,
    measureBetween,
    currentFeatureShapeId,
    buildSketch,
    sketchEdges: occSketchEdges,
  } = useOpenCascade({
    onSketchBuilt: (sketchId, meshData, solvedSketch) => {
      if (solvedSketch) {
        // The solver only updates `primitives`; without this, `elements` (what
        // SketchOverlay renders) stays at its pre-solve position and a driving
        // dimension shows two copies of the shape — see syncElementsFromPrimitives.
        const synced = {
          ...solvedSketch,
          elements: syncElementsFromPrimitives(solvedSketch.elements, solvedSketch.primitives),
        };
        updateSketchState(sketchId, synced);
      }
    },
    onFeatureBuilt: () => {
      notifications.show({ color: 'green', message: 'Feature built successfully' });
    },
    onRebuildComplete: () => {
      notifications.show({ color: 'green', message: 'Rebuild complete' });
    },
    onFaceGeometry: (faceId, origin, normal, boundaryEdges) => {
      // Create sketch with the actual face geometry
      if (pendingSketchOnFace === faceId) {
        const plane: SketchPlane = {
          type: PlaneType.CUSTOM,
          planeRef: `face-${faceId}`,
          offset: 0,
          origin,
          normal,
        };

        const newSketch = addSketch(`Sketch ${project.sketches.length + 1}`, plane);

        // Import boundary edges as external fixed primitives
        if (boundaryEdges && boundaryEdges.length > 0) {
          const externalPrims = boundaryEdges.map(edgeTag => ({
            id: crypto.randomUUID(),
            type: 'line' as const, // Placeholder, worker will refine
            data: {},
            fixed: true,
            isExternal: true,
            sourceId: edgeTag
          }));
          const updatedSketch = {
            ...newSketch,
            primitives: externalPrims
          };
          updateSketchState(newSketch.id, updatedSketch);
          buildSketch(updatedSketch);
        }

        startSketchEdit(newSketch.id);
        selectTreeItem(newSketch.id);
        notifications.show({ color: 'blue', message: `Sketch created on Face ${faceId + 1} with ${boundaryEdges?.length || 0} imported edges` });
        setPendingSketchOnFace(null);
      }
    },
    onEdgeLoop: (_requestId, edgeIndices) => {
      // Light up the whole loop; the picked edge stays the primary selection.
      useViewportStore.getState().setSelectedEdgeIndices(edgeIndices);
    },
    onSelectorResolved: (requestId, refs) => {
      const resolve = pendingSelectorResolutions.current.get(requestId);
      if (resolve) {
        pendingSelectorResolutions.current.delete(requestId);
        resolve(refs);
      }
    },
    onMeasured: (_requestId, result) => {
      onMeasuredRef.current?.(result);
    },
    onMeasuredBetween: (_requestId, result) => {
      onMeasuredBetweenRef.current?.(result);
    },
    onExported: (requestId, format, content) => {
      // Trigger a browser download of the serialized file. The suggested name
      // was stashed against the requestId when the export was kicked off.
      const fileName = pendingExports.current.get(requestId) ?? `model.${EXPORT_EXTENSIONS[format]}`;
      pendingExports.current.delete(requestId);
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      notifications.show({ color: 'green', message: `Exported ${fileName}` });
    },
    onRefsEnriched: (enrichments) => {
      // Persist lazily-captured fingerprints (no version bump -> no rebuild loop).
      applyRefEnrichments(enrichments);
    },
    onSketchRefsEnriched: (enrichments) => {
      // Persist external-geometry fingerprints (no version bump). See step 3c.
      applySketchRefEnrichments(enrichments);
    },
    onError: (message, featureId) => {
      if (featureId) {
        setItemError(featureId, message);
      } else {
        notifications.show({
          color: 'red',
          title: 'Error',
          message: message,
        });
        setPendingSketchOnFace(null);
      }
    },
  });

  // Measure callbacks are wired lazily by useMeasurement (which needs
  // currentFeatureShapeId from this hook's return value, so it's constructed
  // after this hook runs). Deferred via refs so onMeasured/onMeasuredBetween
  // above can be created before useMeasurement's setters exist.
  const onMeasuredRef = useRef<((result: any) => void) | undefined>(undefined);
  const onMeasuredBetweenRef = useRef<((result: any) => void) | undefined>(undefined);
  const setMeasuredHandlers = useCallback((onMeasured: (result: any) => void, onMeasuredBetween: (result: any) => void) => {
    onMeasuredRef.current = onMeasured;
    onMeasuredBetweenRef.current = onMeasuredBetween;
  }, []);

  // Promise-based wrapper around the worker's request/response resolveSelector
  // bridge method, for the OperationPanel "select by rule" input (ROADMAP §9.1
  // Phase 3). Resolves to [] if there's no live body to select against yet.
  const resolveSelectorAsync = useCallback(
    (kind: SubShapeKind, selector: string): Promise<StableRef[]> => {
      if (!currentFeatureShapeId) return Promise.resolve([]);
      return new Promise((resolve) => {
        const requestId = crypto.randomUUID();
        pendingSelectorResolutions.current.set(requestId, resolve);
        resolveSelector(requestId, currentFeatureShapeId, kind, selector);
      });
    },
    [currentFeatureShapeId, resolveSelector]
  );

  // Kick off an export and remember the suggested download filename against
  // the request id (resolved in onExported above).
  const exportShape = useCallback((requestId: string, shapeId: string, format: ExportFormat, fileName: string) => {
    pendingExports.current.set(requestId, fileName);
    rawExportShape(requestId, shapeId, format);
  }, [rawExportShape]);

  // Track last rebuilt version / project ID (moved from OpenCascadeViewport)
  const lastRebuiltVersion = useRef<number>(0);
  const lastProjectId = useRef<string | null>(null);

  // Clear mesh when project ID changes (new project created)
  useEffect(() => {
    if (lastProjectId.current !== null && lastProjectId.current !== project.id) {
      clearMesh();
      lastRebuiltVersion.current = 0;
    }
    lastProjectId.current = project.id;
  }, [project.id, clearMesh]);

  // Trigger rebuild when project version changes OR on initial load with features.
  // Compare with `!==` (not `>`) so an undo — which restores a snapshot with a
  // LOWER version — still rebuilds. Versions are unique per recorded edit, so any
  // change between distinct states (forward edit, undo, or redo) means rebuild.
  useEffect(() => {
    if (occStatus !== 'ready') return;

    if (project.version !== lastRebuiltVersion.current) {
      lastRebuiltVersion.current = project.version;
      clearAllItemErrors();
      rebuild(project, resolveTessellationQuality(tessellationLevel));
    }
  }, [project.id, project.version, occStatus, rebuild, project, clearAllItemErrors, tessellationLevel]);

  // Re-mesh the current model when the tessellation quality changes. The
  // geometry is unchanged (no version bump), only the mesh deflection differs,
  // so this bypasses the version guard above. A ref tracks the last-applied
  // level so this effect is a no-op on unrelated project/rebuild re-runs.
  const lastTessellationLevel = useRef(tessellationLevel);
  useEffect(() => {
    if (occStatus !== 'ready') return;
    if (lastTessellationLevel.current === tessellationLevel) return;
    lastTessellationLevel.current = tessellationLevel;
    rebuild(project, resolveTessellationQuality(tessellationLevel));
  }, [tessellationLevel, occStatus, rebuild, project]);

  return {
    occStatus,
    occProgress,
    occError,
    occMesh,
    occRetry,
    occSketchEdges,
    rebuild,
    clearMesh,
    extrudeSketch,
    getFaceGeometry,
    getEdgeLoop,
    measureShape,
    measureBetween,
    currentFeatureShapeId,
    buildSketch,
    resolveSelectorAsync,
    exportShape,
    setMeasuredHandlers,
  };
}
