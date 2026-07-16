import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { OperationPanel } from "@/frontend/ui/operations/OperationPanel";
import { FeatureOperation, type CADProject, type StableRef } from "@/cad/types";

const emptyProject: CADProject = {
  id: "p1",
  name: "Test Project",
  version: 1,
  referenceGeometry: [],
  sketches: [],
  features: [],
  createdAt: 0,
  updatedAt: 0,
};

describe("OperationPanel — selector-rule input (ROADMAP §9.1 Phase 3)", () => {
  const baseProps = {
    title: "Fillet",
    operation: FeatureOperation.FILLET,
    project: emptyProject,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("resolving a rule fills the edge selection", async () => {
    const refs: StableRef[] = [{ kind: "edge", index: 2 }];
    const onResolveSelector = vi.fn().mockResolvedValue(refs);
    renderWithProviders(<OperationPanel {...baseProps} onResolveSelector={onResolveSelector} />);

    const input = screen.getByPlaceholderText(/all vertical edges/i);
    await userEvent.type(input, "|Z{Enter}");

    expect(onResolveSelector).toHaveBeenCalledWith("edge", "|Z");
    await waitFor(() => expect(screen.getByText(/Matched/i)).toBeInTheDocument());
    expect(screen.getAllByText("edge-2").length).toBeGreaterThan(0);
  });

  it("shows a no-match state when the rule matches nothing", async () => {
    const onResolveSelector = vi.fn().mockResolvedValue([]);
    renderWithProviders(<OperationPanel {...baseProps} onResolveSelector={onResolveSelector} />);

    const input = screen.getByPlaceholderText(/all vertical edges/i);
    await userEvent.type(input, "%torus{Enter}");

    await waitFor(() => expect(screen.getByText(/No sub-shapes matched/i)).toBeInTheDocument());
  });

  it("a preset chip applies its selector immediately", async () => {
    const refs: StableRef[] = [{ kind: "edge", index: 0 }, { kind: "edge", index: 1 }];
    const onResolveSelector = vi.fn().mockResolvedValue(refs);
    renderWithProviders(<OperationPanel {...baseProps} onResolveSelector={onResolveSelector} />);

    await userEvent.click(screen.getByRole("button", { name: "All vertical edges" }));

    expect(onResolveSelector).toHaveBeenCalledWith("edge", "|Z");
    await waitFor(() => expect(screen.getAllByText("edge-0").length).toBeGreaterThan(0));
    expect(screen.getAllByText("edge-1").length).toBeGreaterThan(0);
  });

  it("omits the selector input entirely when onResolveSelector is not provided", () => {
    renderWithProviders(<OperationPanel {...baseProps} />);
    expect(screen.queryByPlaceholderText(/all vertical edges/i)).not.toBeInTheDocument();
  });

  it("checking 'keep this rule live' persists the selector into the confirmed params (Phase 4)", async () => {
    const refs: StableRef[] = [{ kind: "edge", index: 2 }];
    const onResolveSelector = vi.fn().mockResolvedValue(refs);
    const onConfirm = vi.fn();
    renderWithProviders(<OperationPanel {...baseProps} onResolveSelector={onResolveSelector} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByLabelText(/keep this rule live/i));
    const input = screen.getByPlaceholderText(/all vertical edges/i);
    await userEvent.type(input, "|Z{Enter}");
    await waitFor(() => expect(screen.getByText(/Matched/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ selector: "|Z" }), undefined);
  });
});
