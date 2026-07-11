import type { WorkerRequest, WorkerResponse } from "@/worker/types";
import type { CorrelatedCallMap, CorrelatedCallType } from "@/worker/types/messages";
import { CORRELATED_RESPONSE_TYPES } from "@/worker/types/messages";
import type {
  MeshData as CADMeshData,
  ExtrudeParams,
  RevolveParams,
  CADProject,
  Point3D,
  Vector3D,
  Sketch,
  FeatureRefEnrichment,
  SketchRefEnrichment,
  SubShapeKind,
  ExportFormat,
  MeasureSelection,
  TessellationQuality,
} from "@/cad/types";
import { useOccStore } from "@/frontend/shared/occStore";
import { useViewportStore } from "@/frontend/shared/viewportStore";
import { notifications } from "@mantine/notifications";

export type { OCCStatus, MeshData } from "@/frontend/shared/occStore";

interface OCCClientEvents {
  sketchBuilt: (sketchId: string, meshData: CADMeshData, solvedSketch?: Sketch) => void;
  featureBuilt: (featureId: string, meshData: CADMeshData) => void;
  rebuildComplete: (meshData: CADMeshData) => void;
  rebuildProgress: (progress: number, currentFeatureId: string) => void;
  faceGeometry: (faceId: number, origin: Point3D, normal: Vector3D, boundaryEdges?: string[]) => void;
  error: (message: string, featureId?: string) => void;
  refsEnriched: (enrichments: FeatureRefEnrichment[]) => void;
  sketchRefsEnriched: (enrichments: SketchRefEnrichment[]) => void;
}

type EventName = keyof OCCClientEvents;

const listeners: { [K in EventName]: Set<OCCClientEvents[K]> } = {
  sketchBuilt: new Set(),
  featureBuilt: new Set(),
  rebuildComplete: new Set(),
  rebuildProgress: new Set(),
  faceGeometry: new Set(),
  error: new Set(),
  refsEnriched: new Set(),
  sketchRefsEnriched: new Set(),
};

function emit<K extends EventName>(name: K, ...args: Parameters<OCCClientEvents[K]>) {
  for (const listener of listeners[name]) {
    (listener as (...a: Parameters<OCCClientEvents[K]>) => void)(...args);
  }
}

/** Subscribe to a worker orchestration event. Returns an unsubscribe function. */
export function on<K extends EventName>(name: K, cb: OCCClientEvents[K]): () => void {
  listeners[name].add(cb);
  return () => {
    listeners[name].delete(cb);
  };
}

const pendingCalls = new Map<string, (response: WorkerResponse) => void>();

let worker: Worker | null = null;

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("./opencascadeWorker.ts", import.meta.url), { type: "module" });

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as WorkerResponse;
    const store = useOccStore.getState();

    // Generic requestId-correlated dispatch for call() — resolves the pending
    // promise and skips the type-specific case below.
    if (CORRELATED_RESPONSE_TYPES.has(msg.type) && "requestId" in msg) {
      const resolve = pendingCalls.get(msg.requestId);
      if (resolve) {
        pendingCalls.delete(msg.requestId);
        resolve(msg);
        return;
      }
    }

    switch (msg.type) {
      case "ready":
        store.setStatus("ready");
        store.setProgress("");
        break;

      case "progress":
        store.setProgress(msg.message);
        break;

      case "sketchBuilt":
        // geometry/meshData are absent when the profile couldn't be faced; the
        // constraint solve still round-trips via solvedSketch, so apply that
        // regardless and only update mesh/shape when geometry was produced.
        if (msg.meshData) store.setMesh(msg.meshData);
        if (msg.geometry) store.setCurrentShapeId(msg.geometry.shapeId);
        store.setStatus("ready");
        emit("sketchBuilt", msg.sketchId, msg.meshData as CADMeshData, msg.solvedSketch);
        break;

      case "featureBuilt":
        store.setMesh(msg.meshData);
        store.setCurrentShapeId(msg.geometry.shapeId);
        store.setCurrentFeatureShapeId(msg.geometry.shapeId);
        store.setStatus("ready");
        emit("featureBuilt", msg.featureId, msg.meshData);
        break;

      case "rebuildComplete":
        console.log(`[Main Thread] Rebuild complete. Received mesh with ${msg.meshData.faceVertices.length / 3} vertices.`);
        store.setMesh(msg.meshData);
        store.setCurrentShapeId(msg.shapeId);
        store.setCurrentFeatureShapeId(msg.shapeId);
        store.setSketchEdges(msg.sketchEdges ?? null);
        store.setStatus("ready");
        store.setProgress("");
        emit("rebuildComplete", msg.meshData);
        if (msg.refEnrichments?.length) emit("refsEnriched", msg.refEnrichments);
        if (msg.sketchRefEnrichments?.length) emit("sketchRefsEnriched", msg.sketchRefEnrichments);
        break;

      case "rebuildProgress":
        store.setProgress(`Rebuilding: ${Math.round(msg.progress * 100)}%`);
        emit("rebuildProgress", msg.progress, msg.currentFeatureId);
        break;

      case "faceGeometry":
        emit("faceGeometry", msg.faceId, msg.origin, msg.normal, msg.boundaryEdges);
        break;

      case "error":
        if (!msg.featureId) {
          store.setError(msg.message);
          store.setStatus("error");
        } else {
          // Per-feature errors (e.g. a failed sketch build) don't put the whole
          // app in an error state, but the worker is no longer busy.
          store.setStatus("ready");
        }
        emit("error", msg.message, msg.featureId);
        break;
    }
  };

  worker.onerror = (err) => {
    useOccStore.getState().setError(err.message ?? "Worker error");
    useOccStore.getState().setStatus("error");
  };

  worker.postMessage({ type: "init" });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      worker?.terminate();
      worker = null;
    });
  }

  return worker;
}

// Eagerly spawn the worker on module load (mirrors the old hook's mount-time spawn).
getWorker();

export function buildSketch(sketch: Sketch): void {
  const w = getWorker();
  const { status, currentFeatureShapeId } = useOccStore.getState();
  if (status === "loading") return;
  useOccStore.getState().setStatus("building");
  useOccStore.getState().setError(null);
  const message: WorkerRequest = {
    type: "buildSketch",
    sketch,
    bodyId: currentFeatureShapeId || undefined,
  };
  w.postMessage(message);
}

export const solveSketch = buildSketch;

export function extrudeSketch(featureId: string, sketchId: string, params: ExtrudeParams): void {
  const w = getWorker();
  if (useOccStore.getState().status === "loading") return;
  useOccStore.getState().setStatus("building");
  useOccStore.getState().setError(null);
  const message: WorkerRequest = { type: "extrudeSketch", featureId, sketchId, params };
  w.postMessage(message);
}

export function revolveSketch(featureId: string, sketchId: string, params: RevolveParams): void {
  const w = getWorker();
  if (useOccStore.getState().status === "loading") return;
  useOccStore.getState().setStatus("building");
  useOccStore.getState().setError(null);
  const message: WorkerRequest = { type: "revolveSketch", featureId, sketchId, params };
  w.postMessage(message);
}

export function rebuild(project: CADProject, tessellation?: TessellationQuality): void {
  const w = getWorker();
  if (useOccStore.getState().status === "loading") return;
  useOccStore.getState().setStatus("building");
  useOccStore.getState().setError(null);
  const message: WorkerRequest = { type: "rebuild", project, tessellation };
  w.postMessage(message);
}

export function deleteShape(shapeId: string): void {
  const w = getWorker();
  const message: WorkerRequest = { type: "deleteShape", shapeId };
  w.postMessage(message);
}

export function getFaceGeometry(faceId: number, shapeId: string): void {
  const w = getWorker();
  const message: WorkerRequest = { type: "getFaceGeometry", faceId, shapeId };
  w.postMessage(message);
}

// Generic requestId-correlated call — resolves once the worker's matching
// response arrives; never rejects (the worker reports failures via the
// separate 'error' message, surfaced through the 'error' event).
function call<T extends CorrelatedCallType>(
  type: T,
  requestId: string,
  payload: CorrelatedCallMap[T]["request"],
): Promise<CorrelatedCallMap[T]["response"]> {
  return new Promise((resolve) => {
    const w = getWorker();
    pendingCalls.set(requestId, resolve as (response: WorkerResponse) => void);
    const message = { type, requestId, ...payload } as WorkerRequest;
    w.postMessage(message);
  });
}

export function getEdgeLoopRaw(requestId: string, shapeId: string, edgeIndex: number) {
  return call("getEdgeLoop", requestId, { shapeId, edgeIndex });
}

export function resolveSelector(requestId: string, shapeId: string, kind: SubShapeKind, selector: string) {
  return call("resolveSelector", requestId, { shapeId, kind, selector });
}

export function exportShapeRaw(requestId: string, shapeId: string, format: ExportFormat) {
  return call("exportShape", requestId, { shapeId, format });
}

export function measureShapeRaw(requestId: string, shapeId: string) {
  return call("measureShape", requestId, { shapeId });
}

export function measureBetweenRaw(requestId: string, shapeId: string, a: MeasureSelection, b: MeasureSelection) {
  return call("measureBetween", requestId, { shapeId, a, b });
}

export function clearMesh(): void {
  useOccStore.getState().clearMesh();
}

export function retry(): void {
  useOccStore.getState().setStatus("ready");
  useOccStore.getState().setError(null);
}

// --- Value-adding wrappers (moved from useOpenCascadeBridge) ---

/** Resolves a selector string against the current body's sub-shapes; [] if no live body yet. */
export async function resolveSelectorAsync(kind: SubShapeKind, selector: string) {
  const { currentFeatureShapeId } = useOccStore.getState();
  if (!currentFeatureShapeId) return [];
  const response = await resolveSelector(crypto.randomUUID(), currentFeatureShapeId, kind, selector);
  return response.refs;
}

/** Kicks off an export and triggers a browser download once the worker replies. */
export async function exportShape(requestId: string, shapeId: string, format: ExportFormat, fileName: string) {
  const { content } = await exportShapeRaw(requestId, shapeId, format);
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  notifications.show({ color: 'green', message: `Exported ${fileName}` });
}

export async function measureShape(requestId: string, shapeId: string) {
  const { measurement } = await measureShapeRaw(requestId, shapeId);
  return measurement;
}

export async function measureBetween(requestId: string, shapeId: string, a: MeasureSelection, b: MeasureSelection) {
  const { measurement } = await measureBetweenRaw(requestId, shapeId, a, b);
  return measurement;
}

/** Looks up the edge loop containing a picked edge and highlights it in the viewport store. */
export async function getEdgeLoop(requestId: string, shapeId: string, edgeIndex: number) {
  const { edgeIndices } = await getEdgeLoopRaw(requestId, shapeId, edgeIndex);
  useViewportStore.getState().setSelectedEdgeIndices(edgeIndices);
}
