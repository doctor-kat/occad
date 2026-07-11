import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the onmessage handler set on the mock Worker
let workerOnMessage: ((e: MessageEvent) => void) | null = null;
// Every message posted to the (single, most-recent) mock worker instance.
let postedMessages: unknown[] = [];

class MockWorker {
  postMessage = vi.fn((msg: unknown) => {
    postedMessages.push(msg);
  });
  terminate = vi.fn();

  set onmessage(handler: ((e: MessageEvent) => void) | null) {
    workerOnMessage = handler;
  }
  get onmessage() {
    return workerOnMessage;
  }

  onerror: ((e: ErrorEvent) => void) | null = null;
}

vi.stubGlobal("Worker", MockWorker);

// occWorkerClient is a module-level singleton (worker/pendingCalls/listeners
// all live at module scope), so each test needs a fresh module instance —
// reset the module registry and re-import.
async function loadClient() {
  vi.resetModules();
  workerOnMessage = null;
  postedMessages = [];
  const client = await import("./occWorkerClient");
  const { useOccStore } = await import("@/frontend/shared/occStore");
  return { client, useOccStore };
}

function fireWorkerMessage(data: unknown) {
  workerOnMessage?.({ data } as MessageEvent);
}

describe("occWorkerClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("event subscription", () => {
    it("only notifies currently-subscribed listeners, not ones that unsubscribed", async () => {
      const { client } = await loadClient();
      const stale = vi.fn();
      const fresh = vi.fn();

      const unsubscribe = client.on("faceGeometry", stale);
      unsubscribe();
      client.on("faceGeometry", fresh);

      fireWorkerMessage({
        type: "faceGeometry",
        faceId: 7,
        origin: { x: 0, y: 0, z: 10 },
        normal: { x: 0, y: 0, z: 1 },
        boundaryEdges: [],
      });

      expect(stale).not.toHaveBeenCalled();
      expect(fresh).toHaveBeenCalledWith(7, { x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 1 }, []);
    });

    it("emits 'error' to subscribers with the message and optional featureId", async () => {
      const { client } = await loadClient();
      const onError = vi.fn();
      client.on("error", onError);

      fireWorkerMessage({ type: "error", message: "something broke" });

      expect(onError).toHaveBeenCalledWith("something broke", undefined);
    });

    it("emits 'rebuildComplete' to subscribers with the mesh data", async () => {
      const { client } = await loadClient();
      const onRebuildComplete = vi.fn();
      client.on("rebuildComplete", onRebuildComplete);

      const mockMesh = {
        faceVertices: new Float32Array([1, 2, 3]),
        faceNormals: new Float32Array([0, 0, 1]),
        faceIndices: new Uint32Array([0]),
        edgeVertices: new Float32Array([]),
        edgeIndices: new Uint32Array([]),
      };

      fireWorkerMessage({ type: "rebuildComplete", meshData: mockMesh, shapeId: "shape-1" });

      expect(onRebuildComplete).toHaveBeenCalledWith(mockMesh);
    });
  });

  describe("useOccStore writes", () => {
    it("populates mesh/sketchEdges/status from a rebuildComplete message", async () => {
      const { useOccStore } = await loadClient();

      fireWorkerMessage({ type: "ready" });

      const mockEdges = {
        "sketch-1": { edgeVertices: new Float32Array([0, 0, 0, 1, 1, 0]) },
      };

      fireWorkerMessage({
        type: "rebuildComplete",
        meshData: {
          faceVertices: new Float32Array([]),
          faceNormals: new Float32Array([]),
          faceIndices: new Uint32Array([]),
          edgeVertices: new Float32Array([]),
          edgeIndices: new Uint32Array([]),
        },
        shapeId: "final-1",
        sketchEdges: mockEdges,
      });

      const state = useOccStore.getState();
      expect(state.status).toBe("ready");
      expect(state.sketchEdges).toEqual(mockEdges);
      expect(state.currentShapeId).toBe("final-1");
      expect(state.currentFeatureShapeId).toBe("final-1");
    });

    it("clears mesh/sketchEdges/shapeIds via clearMesh()", async () => {
      const { client, useOccStore } = await loadClient();

      fireWorkerMessage({ type: "ready" });
      fireWorkerMessage({
        type: "rebuildComplete",
        meshData: {
          faceVertices: new Float32Array([]),
          faceNormals: new Float32Array([]),
          faceIndices: new Uint32Array([]),
          edgeVertices: new Float32Array([]),
          edgeIndices: new Uint32Array([]),
        },
        shapeId: "final-1",
        sketchEdges: { s1: { edgeVertices: new Float32Array([0, 0, 0]) } },
      });

      expect(useOccStore.getState().sketchEdges).not.toBeNull();

      client.clearMesh();

      expect(useOccStore.getState().sketchEdges).toBeNull();
      expect(useOccStore.getState().mesh).toBeNull();
      expect(useOccStore.getState().currentShapeId).toBeNull();
      expect(useOccStore.getState().currentFeatureShapeId).toBeNull();
    });

    it("sets status to 'error' for a whole-project error (no featureId)", async () => {
      const { useOccStore } = await loadClient();

      fireWorkerMessage({ type: "error", message: "boom" });

      expect(useOccStore.getState().status).toBe("error");
      expect(useOccStore.getState().error).toBe("boom");
    });

    it("keeps status 'ready' for a per-feature error (featureId present)", async () => {
      const { useOccStore } = await loadClient();

      fireWorkerMessage({ type: "ready" });
      fireWorkerMessage({ type: "error", message: "sketch failed", featureId: "feat-1" });

      expect(useOccStore.getState().status).toBe("ready");
    });
  });

  // The generic call() dispatch (Architecture review candidate #1) replaces
  // per-op onXxx callbacks + onmessage cases for resolveSelector/exportShape/
  // measureShape/measureBetween/getEdgeLoop. These cover its requestId
  // correlation, since it's the only new logic — the DTOs themselves are
  // unchanged and covered by their own handler tests.
  describe("call() requestId correlation", () => {
    it("resolves the promise matching the response's requestId, ignoring in-flight others", async () => {
      const { client } = await loadClient();

      let resolveSelectorPromise: Promise<unknown>;
      let measureShapePromise: Promise<unknown>;
      resolveSelectorPromise = client.resolveSelector("req-1", "shape-1", "face" as never, "F1");
      measureShapePromise = client.measureShapeRaw("req-2", "shape-1");

      // Responses arrive out of order; each must resolve its own requestId's promise only.
      fireWorkerMessage({ type: "measured", requestId: "req-2", measurement: { volume: 42 } });
      await expect(measureShapePromise!).resolves.toEqual({
        type: "measured",
        requestId: "req-2",
        measurement: { volume: 42 },
      });

      fireWorkerMessage({ type: "selectorResolved", requestId: "req-1", refs: ["ref-a"] });
      await expect(resolveSelectorPromise!).resolves.toEqual({
        type: "selectorResolved",
        requestId: "req-1",
        refs: ["ref-a"],
      });
    });

    it("posts a message combining the type, requestId, and payload", async () => {
      const { client } = await loadClient();

      void client.measureBetweenRaw(
        "req-3",
        "shape-9",
        { kind: "face", index: 0 } as never,
        { kind: "face", index: 1 } as never,
      );

      const posted = postedMessages.at(-1);
      expect(posted).toEqual({
        type: "measureBetween",
        requestId: "req-3",
        shapeId: "shape-9",
        a: { kind: "face", index: 0 },
        b: { kind: "face", index: 1 },
      });
    });

    it("only fires each pending resolver once, even if the same requestId message arrives twice", async () => {
      const { client } = await loadClient();

      const getEdgeLoopPromise = client.getEdgeLoopRaw("req-4", "shape-1", 2);

      fireWorkerMessage({ type: "edgeLoop", requestId: "req-4", edgeIndices: [1, 2, 3] });
      await expect(getEdgeLoopPromise).resolves.toEqual({
        type: "edgeLoop",
        requestId: "req-4",
        edgeIndices: [1, 2, 3],
      });

      // A stray duplicate/late message for the same requestId must not throw
      // or resolve anything a second time (the pending entry was already removed).
      expect(() =>
        fireWorkerMessage({ type: "edgeLoop", requestId: "req-4", edgeIndices: [9] }),
      ).not.toThrow();
    });
  });
});
