import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Capture the onmessage handler set on the mock Worker
let workerOnMessage: ((e: MessageEvent) => void) | null = null;

class MockWorker {
  postMessage = vi.fn();
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
      });
    });

    expect(staleCallback).not.toHaveBeenCalled();
    expect(freshCallback).toHaveBeenCalledWith(
      7,
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 1 },
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
});
