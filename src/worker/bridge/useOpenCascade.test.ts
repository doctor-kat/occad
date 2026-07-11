import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

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

// Install mock before importing the hook
vi.stubGlobal("Worker", MockWorker);

// Dynamic import so the module picks up the stubbed Worker
const { useOpenCascade } = await import("./useOpenCascade");

function fireWorkerMessage(data: unknown) {
  workerOnMessage?.({ data } as MessageEvent);
}

describe("useOpenCascade", () => {
  beforeEach(() => {
    workerOnMessage = null;
    postedMessages = [];
    vi.clearAllMocks();
  });

  it("should invoke the latest onFaceGeometry callback, not a stale one", () => {
    const staleCallback = vi.fn();
    const freshCallback = vi.fn();

    // Initial render with staleCallback
    const { rerender } = renderHook(
      ({ cb }) => useOpenCascade({ onFaceGeometry: cb }),
      { initialProps: { cb: staleCallback } },
    );

    // Re-render with freshCallback (simulates state change that produces a new closure)
    rerender({ cb: freshCallback });

    // Simulate worker sending faceGeometry message
    act(() => {
      fireWorkerMessage({
        type: "faceGeometry",
        faceId: 7,
        origin: { x: 0, y: 0, z: 10 },
        normal: { x: 0, y: 0, z: 1 },
        boundaryEdges: []
      });
    });

    expect(staleCallback).not.toHaveBeenCalled();
    expect(freshCallback).toHaveBeenCalledWith(
      7,
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 1 },
      []
    );
  });

  it("should invoke the latest onError callback after re-render", () => {
    const staleError = vi.fn();
    const freshError = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useOpenCascade({ onError: cb }),
      { initialProps: { cb: staleError } },
    );

    rerender({ cb: freshError });

    act(() => {
      fireWorkerMessage({ type: "error", message: "something broke" });
    });

    expect(staleError).not.toHaveBeenCalled();
    expect(freshError).toHaveBeenCalledWith("something broke", undefined);
  });

  it("should populate sketchEdges state from rebuildComplete message", () => {
    const { result } = renderHook(() => useOpenCascade());

    // Simulate ready
    act(() => {
      fireWorkerMessage({ type: "ready" });
    });

    const mockEdges = {
      "sketch-1": { edgeVertices: new Float32Array([0, 0, 0, 1, 1, 0]) },
    };

    act(() => {
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
    });

    expect(result.current.sketchEdges).toEqual(mockEdges);
  });

  it("should clear sketchEdges on clearMesh", () => {
    const { result } = renderHook(() => useOpenCascade());

    // Simulate ready + rebuild
    act(() => {
      fireWorkerMessage({ type: "ready" });
    });
    act(() => {
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
        sketchEdges: { "s1": { edgeVertices: new Float32Array([0, 0, 0]) } },
      });
    });

    expect(result.current.sketchEdges).not.toBeNull();

    act(() => {
      result.current.clearMesh();
    });

    expect(result.current.sketchEdges).toBeNull();
  });

  it("should invoke the latest onRebuildComplete callback after re-render", () => {
    const staleCb = vi.fn();
    const freshCb = vi.fn();

    const mockMesh = {
      faceVertices: new Float32Array([1, 2, 3]),
      faceNormals: new Float32Array([0, 0, 1]),
      faceIndices: new Uint32Array([0]),
      edgeVertices: new Float32Array([]),
      edgeIndices: new Uint32Array([]),
    };

    const { rerender } = renderHook(
      ({ cb }) => useOpenCascade({ onRebuildComplete: cb }),
      { initialProps: { cb: staleCb } },
    );

    rerender({ cb: freshCb });

    act(() => {
      fireWorkerMessage({
        type: "rebuildComplete",
        meshData: mockMesh,
        shapeId: "shape-1",
      });
    });

    expect(staleCb).not.toHaveBeenCalled();
    expect(freshCb).toHaveBeenCalledWith(mockMesh);
  });

  // The generic call() dispatch (Architecture review candidate #1) replaces
  // per-op onXxx callbacks + onmessage cases for resolveSelector/exportShape/
  // measureShape/measureBetween/getEdgeLoop. These cover its requestId
  // correlation, since it's the only new logic — the DTOs themselves are
  // unchanged and covered by their own handler tests.
  describe("call() requestId correlation", () => {
    it("resolves the promise matching the response's requestId, ignoring in-flight others", async () => {
      const { result } = renderHook(() => useOpenCascade());

      let resolveSelectorPromise: Promise<unknown>;
      let measureShapePromise: Promise<unknown>;
      act(() => {
        resolveSelectorPromise = result.current.resolveSelector("req-1", "shape-1", "face" as never, "F1");
        measureShapePromise = result.current.measureShape("req-2", "shape-1");
      });

      // Responses arrive out of order; each must resolve its own requestId's promise only.
      act(() => {
        fireWorkerMessage({ type: "measured", requestId: "req-2", measurement: { volume: 42 } });
      });
      await expect(measureShapePromise!).resolves.toEqual({
        type: "measured",
        requestId: "req-2",
        measurement: { volume: 42 },
      });

      act(() => {
        fireWorkerMessage({ type: "selectorResolved", requestId: "req-1", refs: ["ref-a"] });
      });
      await expect(resolveSelectorPromise!).resolves.toEqual({
        type: "selectorResolved",
        requestId: "req-1",
        refs: ["ref-a"],
      });
    });

    it("posts a message combining the type, requestId, and payload", () => {
      const { result } = renderHook(() => useOpenCascade());

      act(() => {
        void result.current.measureBetween("req-3", "shape-9", { kind: "face", index: 0 } as never, { kind: "face", index: 1 } as never);
      });

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
      const { result } = renderHook(() => useOpenCascade());

      let getEdgeLoopPromise: Promise<unknown>;
      act(() => {
        getEdgeLoopPromise = result.current.getEdgeLoop("req-4", "shape-1", 2);
      });

      act(() => {
        fireWorkerMessage({ type: "edgeLoop", requestId: "req-4", edgeIndices: [1, 2, 3] });
      });
      await expect(getEdgeLoopPromise!).resolves.toEqual({
        type: "edgeLoop",
        requestId: "req-4",
        edgeIndices: [1, 2, 3],
      });

      // A stray duplicate/late message for the same requestId must not throw
      // or resolve anything a second time (the pending entry was already removed).
      expect(() =>
        act(() => {
          fireWorkerMessage({ type: "edgeLoop", requestId: "req-4", edgeIndices: [9] });
        }),
      ).not.toThrow();
    });
  });
});
