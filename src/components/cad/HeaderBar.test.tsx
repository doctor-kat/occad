import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { HeaderBar } from "./HeaderBar";

describe("HeaderBar", () => {
  const defaultProps = {
    projectName: "My Project",
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onExport: vi.fn(),
  };

  it('should render "OCCAD" app name', () => {
    renderWithProviders(<HeaderBar {...defaultProps} />);
    expect(screen.getByText("OCCAD")).toBeInTheDocument();
  });

  it("should render the project name", () => {
    renderWithProviders(<HeaderBar {...defaultProps} />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("should call onNew when New button is clicked", async () => {
    const onNew = vi.fn();
    renderWithProviders(<HeaderBar {...defaultProps} onNew={onNew} />);

    await userEvent.click(screen.getByText("New"));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("should call onOpen when Open button is clicked", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<HeaderBar {...defaultProps} onOpen={onOpen} />);

    await userEvent.click(screen.getByText("Open"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("should call onSave when Save button is clicked", async () => {
    const onSave = vi.fn();
    renderWithProviders(<HeaderBar {...defaultProps} onSave={onSave} />);

    await userEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("should call onExport when Export button is clicked", async () => {
    const onExport = vi.fn();
    renderWithProviders(<HeaderBar {...defaultProps} onExport={onExport} />);

    await userEvent.click(screen.getByText("Export"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
