import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerRequest, WorkerResponse } from "@/worker/types";
import type {
  MeshData as CADMeshData,
  SketchEdgeData,
  SketchElement,
  SketchPlane,
  ExtrudeParams,
  RevolveParams,
  CADProject,
  Point3D,
  Vector3D,
  Sketch,
  FeatureRefEnrichment,
  SketchRefEnrichment,
  SubShapeKind,
  StableRef,
  ExportFormat,
} from "@/cad/types";

export type { CADMeshData as MeshData };

export type OCCStatus = "loading" | "ready" | "building" | "error";

interface UseOpenCascadeOptions {
  /** If provided, automatically builds this model once the kernel is ready. */
  initialParams?: { width: number; height: number; thickness: number };
  /** Callback when a sketch is built */
  onSketchBuilt?: (sketchId: string, meshData: CADMeshData, solvedSketch?: Sketch) => void;
  /** Callback when a feature is built */
  onFeatureBuilt?: (featureId: string, meshData: CADMeshData) => void;
  /** Callback when rebuild is complete */
  onRebuildComplete?: (meshData: CADMeshData) => void;
  /** Callback for rebuild progress */
  onRebuildProgress?: (progress: number, currentFeatureId: string) => void;
  /** Callback when face geometry is received */
  onFaceGeometry?: (faceId: number, origin: Point3D, normal: Vector3D, boundaryEdges?: string[]) => void;
  /** Callback when a selector has been resolved to fingerprinted refs (ROADMAP §9.1) */
  onSelectorResolved?: (requestId: string, refs: StableRef[]) => void;
  /** Callback when a shape has been exported to interchange file text (ROADMAP §3) */
  onExported?: (requestId: string, format: ExportFormat, content: string) => void;
  /** Callback when an error occurs */
  onError?: (message: string, featureId?: string) => void;
  /** Callback when the worker captures fingerprint upgrades for selections (step 3b) */
  onRefsEnriched?: (enrichments: FeatureRefEnrichment[]) => void;
  /** Callback when the worker captures fingerprint upgrades for sketch external geometry (step 3c) */
  onSketchRefsEnriched?: (enrichments: SketchRefEnrichment[]) => void;
}

export function useOpenCascade(opts: UseOpenCascadeOptions = {}) {
  // Keep a ref to the latest opts so the worker onmessage handler (which is
  // created once with [] deps) always invokes the current callbacks rather
  // than stale closures captured on the first render.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const workerRef = useRef<Worker | null>(null);
  const hasBuiltInitial = useRef(false);

  const [status, setStatus] = useState<OCCStatus>("loading");
  const [progress, setProgress] = useState("Initialising…");
  const [error, setError] = useState<string | null>(null);
  const [mesh, setMesh] = useState<CADMeshData | null>(null);
  const [currentShapeId, setCurrentShapeId] = useState<string | null>(null);
  const [currentFeatureShapeId, setCurrentFeatureShapeId] = useState<string | null>(null);
  const [sketchEdges, setSketchEdges] = useState<Record<string, SketchEdgeData> | null>(null);

  // Spawn worker once
  useEffect(() => {
    const worker = new Worker(
      new URL("./opencascadeWorker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as WorkerResponse;

      switch (msg.type) {
        case "ready":
          setStatus("ready");
          setProgress("");
          // Auto-build initial model (legacy bottle demo)
          if (optsRef.current.initialParams && !hasBuiltInitial.current) {
            hasBuiltInitial.current = true;
            setStatus("building");
            worker.postMessage({ type: "build", params: optsRef.current.initialParams });
          }
          break;

        case "progress":
          setProgress(msg.message);
          break;

        case "sketchBuilt":
          // geometry/meshData are absent when the profile couldn't be faced; the
          // constraint solve still round-trips via solvedSketch, so apply that
          // regardless and only update mesh/shape when geometry was produced.
          if (msg.meshData) setMesh(msg.meshData);
          if (msg.geometry) setCurrentShapeId(msg.geometry.shapeId);
          setStatus("ready");
          optsRef.current.onSketchBuilt?.(msg.sketchId, msg.meshData as CADMeshData, msg.solvedSketch);
          break;

        case "featureBuilt":
          setMesh(msg.meshData);
          setCurrentShapeId(msg.geometry.shapeId);
          setCurrentFeatureShapeId(msg.geometry.shapeId); // Track last feature shape
          setStatus("ready");
          optsRef.current.onFeatureBuilt?.(msg.featureId, msg.meshData);
          break;

        case "rebuildComplete":
          console.log(`[Main Thread] Rebuild complete. Received mesh with ${msg.meshData.faceVertices.length / 3} vertices.`);
          setMesh(msg.meshData);
          setCurrentShapeId(msg.shapeId);
          setCurrentFeatureShapeId(msg.shapeId); // Track last feature shape
          setSketchEdges(msg.sketchEdges ?? null);
          setStatus("ready");
          setProgress("");
          optsRef.current.onRebuildComplete?.(msg.meshData);
          if (msg.refEnrichments?.length) optsRef.current.onRefsEnriched?.(msg.refEnrichments);
          if (msg.sketchRefEnrichments?.length) optsRef.current.onSketchRefsEnriched?.(msg.sketchRefEnrichments);
          break;

        case "rebuildProgress":
          setProgress(`Rebuilding: ${Math.round(msg.progress * 100)}%`);
          optsRef.current.onRebuildProgress?.(msg.progress, msg.currentFeatureId);
          break;

        case "faceGeometry":
          optsRef.current.onFaceGeometry?.(msg.faceId, msg.origin, msg.normal, msg.boundaryEdges);
          break;

        case "selectorResolved":
          optsRef.current.onSelectorResolved?.(msg.requestId, msg.refs);
          break;

        case "exported":
          optsRef.current.onExported?.(msg.requestId, msg.format, msg.content);
          break;

        case "error":
          if (!msg.featureId) {
            setError(msg.message);
            setStatus("error");
          } else {
            // Per-feature errors (e.g. a failed sketch build) don't put the
            // whole app in an error state, but the worker is no longer busy —
            // clear "building" so the LoadingOverlay doesn't block the canvas forever.
            setStatus("ready");
          }
          optsRef.current.onError?.(msg.message, msg.featureId);
          break;
      }
    };

    worker.onerror = (err) => {
      setError(err.message ?? "Worker error");
      setStatus("error");
    };

    workerRef.current = worker;
    worker.postMessage({ type: 'init' });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build/Solve sketch from full state
  const buildSketch = useCallback(
    (sketch: Sketch) => {
      const w = workerRef.current;
      if (!w || status === "loading") return;
      setStatus("building");
      setError(null);
      const message: WorkerRequest = {
        type: "buildSketch",
        sketch,
        bodyId: currentFeatureShapeId || undefined,
      };
      w.postMessage(message);
    },
    [status, currentFeatureShapeId],
  );

  // Extrude sketch
  const extrudeSketch = useCallback(
    (featureId: string, sketchId: string, params: ExtrudeParams) => {
      const w = workerRef.current;
      if (!w || status === "loading") return;
      setStatus("building");
      setError(null);
      const message: WorkerRequest = {
        type: "extrudeSketch",
        featureId,
        sketchId,
        params,
      };
      w.postMessage(message);
    },
    [status],
  );

  // Revolve sketch
  const revolveSketch = useCallback(
    (featureId: string, sketchId: string, params: RevolveParams) => {
      const w = workerRef.current;
      if (!w || status === "loading") return;
      setStatus("building");
      setError(null);
      const message: WorkerRequest = {
        type: "revolveSketch",
        featureId,
        sketchId,
        params,
      };
      w.postMessage(message);
    },
    [status],
  );

  // Full rebuild from project history
  const rebuild = useCallback(
    (project: CADProject) => {
      const w = workerRef.current;
      if (!w || status === "loading") return;
      setStatus("building");
      setError(null);
      const message: WorkerRequest = {
        type: "rebuild",
        project,
      };
      w.postMessage(message);
    },
    [status],
  );

  // Delete shape from worker storage
  const deleteShape = useCallback((shapeId: string) => {
    const w = workerRef.current;
    if (!w) return;
    const message: WorkerRequest = {
      type: "deleteShape",
      shapeId,
    };
    w.postMessage(message);
  }, []);

  // Get face geometry from worker
  const getFaceGeometry = useCallback((faceId: number, shapeId: string) => {
    const w = workerRef.current;
    if (!w) return;
    const message: WorkerRequest = {
      type: "getFaceGeometry",
      faceId,
      shapeId,
    };
    w.postMessage(message);
  }, []);

  // Resolve a selector string (ROADMAP §9.1) against a body's sub-shapes
  const resolveSelector = useCallback((requestId: string, shapeId: string, kind: SubShapeKind, selector: string) => {
    const w = workerRef.current;
    if (!w) return;
    const message: WorkerRequest = {
      type: "resolveSelector",
      requestId,
      shapeId,
      kind,
      selector,
    };
    w.postMessage(message);
  }, []);

  // Export a stored shape to a standard interchange format (ROADMAP §3)
  const exportShape = useCallback((requestId: string, shapeId: string, format: ExportFormat) => {
    const w = workerRef.current;
    if (!w) return;
    const message: WorkerRequest = {
      type: "exportShape",
      requestId,
      shapeId,
      format,
    };
    w.postMessage(message);
  }, []);

  const clearMesh = useCallback(() => {
    setMesh(null);
    setCurrentShapeId(null);
    setCurrentFeatureShapeId(null);
    setSketchEdges(null);
  }, []);

  const retry = useCallback(() => {
    setStatus("ready");
    setError(null);
  }, []);

  return {
    status,
    progress,
    error,
    mesh,
    currentShapeId,
    currentFeatureShapeId,
    sketchEdges,
    buildSketch,
    solveSketch: buildSketch,
    extrudeSketch,
    revolveSketch,
    rebuild,
    deleteShape,
    getFaceGeometry,
    resolveSelector,
    exportShape,
    clearMesh,
    retry,
  };
}
