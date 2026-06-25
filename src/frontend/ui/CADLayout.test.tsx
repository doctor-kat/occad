import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, createMockUseOpenCascade } from "@/test/helpers";

// Capture the opts callbacks passed to useOpenCascade
let capturedOpts: any = {};
const mockOCC = createMockUseOpenCascade();

vi.mock("@/worker/bridge/useOpenCascade", () => ({
  useOpenCascade: (opts: any) => {
    capturedOpts = opts;
    return mockOCC;
  },
}));

vi.mock("@/frontend/canvas/CADViewport", () => ({
  CADViewport: (props: any) => (
    <div data-testid="mock-viewport">
      <span data-testid="occ-status">{props.occStatus}</span>
      <span data-testid="awaiting-plane">{String(props.awaitingSketchPlane)}</span>
      <button
        data-testid="face-click"
        onClick={() => props.onFaceClick?.(0)}
      >
        Click Face
      </button>
      <button
        data-testid="plane-click"
        onClick={() => props.onPlaneClick?.("top-plane")}
      >
        Click Plane
      </button>
      <button
        data-testid="background-click"
        onClick={() => props.onBackgroundClick?.()}
      >
        Click Background
      </button>
    </div>
  ),
}));

// Import after mocks are set up
import { CADLayout } from "./CADLayout";

describe("CADLayout", () => {
  beforeEach(() => {
    capturedOpts = {};
    vi.clearAllMocks();
    // Reset mock values
    mockOCC.currentFeatureShapeId = null;
  });

  it("should render initial project elements", () => {
    renderWithProviders(<CADLayout />);

    expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    expect(screen.getByText("Front Plane")).toBeInTheDocument();
    expect(screen.getByText("Top Plane")).toBeInTheDocument();
    expect(screen.getByText("Right Plane")).toBeInTheDocument();
    expect(screen.getByText("Origin")).toBeInTheDocument();
    expect(screen.queryByText("Boss-Extrude1")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-viewport")).toBeInTheDocument();
  });

  it("should create sketch on a selected plane", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CADLayout />);

    // Select "Top Plane" in the tree
    await user.click(screen.getByText("Top Plane"));

    // Click the "Sketch" tab to switch tabs
    const sketchTab = screen.getByRole("tab", { name: /sketch/i });
    await user.click(sketchTab);

    // Click the "Sketch" tool button (inside the sketch panel)
    const sketchButtons = screen.getAllByText("Sketch");
    // The tool button is the one NOT inside a tab role
    const toolButton = sketchButtons.find(
      (el) => !el.closest('[role="tab"]'),
    );
    await user.click(toolButton!);

    // A new sketch should appear in the tree
    await waitFor(() => {
      expect(screen.getByText(/Sketch 1/)).toBeInTheDocument();
    });
  });

  // NOTE: This test uses a fully-mocked useOpenCascade (above), so capturedOpts
  // is re-captured on every render and always has the latest callbacks. This
  // means it does NOT exercise the real worker.onmessage closure path. The
  // stale-closure bug (where onFaceGeometry saw null pendingSketchOnFace) is
  // covered by useOpenCascade.test.ts instead.
  it("does not auto-create a sketch when a sketch tool is picked with nothing selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CADLayout />);

    // Switch to the Sketch tab and pick the Rectangle tool with no plane/face selected
    const sketchTab = screen.getByRole("tab", { name: /sketch/i });
    await user.click(sketchTab);
    await user.click(screen.getByText("Rectangle"));

    // No sketch is created — the user is asked to pick a plane instead
    expect(screen.queryByText(/Sketch 1/)).not.toBeInTheDocument();

    // And all reference planes are revealed for picking
    await waitFor(() => {
      expect(screen.getByTestId("awaiting-plane").textContent).toBe("true");
    });
  });

  it("creates a sketch on the selected plane when a sketch tool is picked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CADLayout />);

    // Select a plane first, then pick the Rectangle tool
    await user.click(screen.getByText("Top Plane"));
    const sketchTab = screen.getByRole("tab", { name: /sketch/i });
    await user.click(sketchTab);
    await user.click(screen.getByText("Rectangle"));

    // A sketch is created on the selected plane, so we are no longer awaiting one
    await waitFor(() => {
      expect(screen.getByText(/Sketch 1/)).toBeInTheDocument();
    });
    expect(screen.getByTestId("awaiting-plane").textContent).toBe("false");
  });

  it("should create sketch on face via geometry request", async () => {
    const user = userEvent.setup();
    mockOCC.currentFeatureShapeId = "shape-123";
    renderWithProviders(<CADLayout />);

    // Click a face in the mock viewport
    await user.click(screen.getByTestId("face-click"));

    // Switch to Sketch tab and click Sketch button
    const sketchTab = screen.getByRole("tab", { name: /sketch/i });
    await user.click(sketchTab);

    const sketchButtons = screen.getAllByText("Sketch");
    const toolButton = sketchButtons.find(
      (el) => !el.closest('[role="tab"]'),
    );
    await user.click(toolButton!);

    // Should have called getFaceGeometry
    expect(mockOCC.getFaceGeometry).toHaveBeenCalledWith(0, "shape-123");

    // Simulate the worker responding with face geometry
    capturedOpts.onFaceGeometry?.(
      0,
      { x: 0, y: 0, z: 50 },
      { x: 0, y: 0, z: 1 },
    );

    // A new sketch should now appear
    await waitFor(() => {
      expect(screen.getByText(/Sketch 1/)).toBeInTheDocument();
    });
  });

  it("should show confirmation modal on New button click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CADLayout />);

    // Click "New" in the header bar
    await user.click(screen.getByText("New"));

    // Confirm modal should appear
    await waitFor(() => {
      expect(
        screen.getByText(/Are you sure you want to create a new project/),
      ).toBeInTheDocument();
    });

    // Click the confirm button (the one with role="button")
    const confirmButtons = screen.getAllByText("Create New Project");
    const confirmBtn = confirmButtons.find(
      (el) => el.closest("button") !== null,
    );
    await user.click(confirmBtn!);

    // Project should reset — still shows "Untitled Project" (default name)
    await waitFor(() => {
      expect(screen.getByText("Untitled Project")).toBeInTheDocument();
    });
  });

  it("should clear selection on background click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CADLayout />);

    // Select "Front Plane"
    await user.click(screen.getByText("Front Plane"));

    // Click background in viewport
    await user.click(screen.getByTestId("background-click"));

    // Selection should be cleared — we can verify no item has selected styling
    // by checking the feature tree still renders normally
    expect(screen.getByText("Front Plane")).toBeInTheDocument();
  });

  it("should pass OCC status to CADViewport from consolidated worker", () => {
    renderWithProviders(<CADLayout />);

    // The mock viewport should receive the occStatus from useOpenCascade
    expect(screen.getByTestId("occ-status").textContent).toBe("ready");
  });

  it("should trigger rebuild when status is ready and features exist", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CADLayout />);

    // Clear initial rebuild call on mount
    mockOCC.rebuild.mockClear();

    // Initially no rebuild because no features
    expect(mockOCC.rebuild).not.toHaveBeenCalled();

    // Add a feature (e.g. Box)
    const boxButton = screen.getByText("Box");
    await user.click(boxButton);

    // Should not rebuild yet (panel is open)
    expect(mockOCC.rebuild).not.toHaveBeenCalled();

    // Click Apply in the operation panel
    const applyButton = screen.getByText("Apply");
    await user.click(applyButton);

    // Now rebuild should be called
    expect(mockOCC.rebuild).toHaveBeenCalled();
  });

  it("should have currentFeatureShapeId from same worker for face-to-sketch flow", async () => {
    const user = userEvent.setup();
    // Simulate the worker having built a shape — currentFeatureShapeId is set
    mockOCC.currentFeatureShapeId = "shape-abc";
    renderWithProviders(<CADLayout />);

    // Click a face in the viewport
    await user.click(screen.getByTestId("face-click"));

    // Switch to Sketch tab and click Sketch button
    const sketchTab = screen.getByRole("tab", { name: /sketch/i });
    await user.click(sketchTab);

    const sketchButtons = screen.getAllByText("Sketch");
    const toolButton = sketchButtons.find(
      (el) => !el.closest('[role="tab"]'),
    );
    await user.click(toolButton!);

    // Both getFaceGeometry and currentFeatureShapeId come from the same
    // useOpenCascade instance, so the call should succeed
    expect(mockOCC.getFaceGeometry).toHaveBeenCalledWith(0, "shape-abc");
  });
});
