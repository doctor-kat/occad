import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { Toolbar } from "./Toolbar";

describe("Toolbar", () => {
  const defaultProps = {
    projectName: "My Project",
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onExport: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    tessellationLevel: "standard" as const,
    onTessellationLevelChange: vi.fn(),
  };

  it('should render "OCCAD" app name', () => {
    renderWithProviders(<Toolbar {...defaultProps} />);
    expect(screen.getByText("OCCAD")).toBeInTheDocument();
  });

  it("should render the project name", () => {
    renderWithProviders(<Toolbar {...defaultProps} />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("should call onNew when New button is clicked", async () => {
    const onNew = vi.fn();
    renderWithProviders(<Toolbar {...defaultProps} onNew={onNew} />);

    await userEvent.click(screen.getByText("New"));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("should call onOpen when Open button is clicked", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<Toolbar {...defaultProps} onOpen={onOpen} />);

    await userEvent.click(screen.getByText("Open"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("should call onSave when Save button is clicked", async () => {
    const onSave = vi.fn();
    renderWithProviders(<Toolbar {...defaultProps} onSave={onSave} />);

    await userEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("should call onExport when Export button is clicked", async () => {
    const onExport = vi.fn();
    renderWithProviders(<Toolbar {...defaultProps} onExport={onExport} />);

    await userEvent.click(screen.getByText("Export"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("opens the Settings menu and changes tessellation quality", async () => {
    const onTessellationLevelChange = vi.fn();
    renderWithProviders(
      <Toolbar {...defaultProps} onTessellationLevelChange={onTessellationLevelChange} />
    );

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByText("Tessellation quality")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Fine"));
    expect(onTessellationLevelChange).toHaveBeenCalledWith("fine");
  });
});
