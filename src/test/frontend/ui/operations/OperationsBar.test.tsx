import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { OperationsBar } from "@/frontend/ui/operations/OperationsBar";
import { OperationCategory, SketchOperation } from "@/cad/types";

describe("OperationsBar — sketch tab", () => {
  const defaultProps = {
    activeTab: OperationCategory.SKETCH,
    activeOperation: null,
    onTabChange: vi.fn(),
    onOperationSelect: vi.fn(),
    onSketchButtonClick: vi.fn(),
  };

  it("renders Line and Corner Rectangle as compact group buttons", () => {
    renderWithProviders(<OperationsBar {...defaultProps} />);

    const line = screen.getByText("Line").closest("button");
    const rectangle = screen.getByText("Corner Rectangle").closest("button");

    expect(line).toBeInTheDocument();
    expect(rectangle).toBeInTheDocument();

    // The group's body is the narrow horizontal compact (116px) variant.
    expect(line).toHaveStyle({ width: "116px" });
    expect(rectangle).toHaveStyle({ width: "116px" });

    // Each group exposes a caret to open its dropdown.
    expect(screen.getByRole("button", { name: "Line options" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Corner Rectangle options" }),
    ).toBeInTheDocument();
  });

  it("renders every sketch tool small (compact), not as a 72px square button", () => {
    renderWithProviders(<OperationsBar {...defaultProps} />);

    // Circle is a compact group body (116px); Polygon is a plain compact button (116px).
    const circle = screen.getByText("Circle").closest("button");
    const polygon = screen.getByText("Polygon").closest("button");
    expect(circle).toHaveStyle({ width: "116px" });
    expect(polygon).toHaveStyle({ width: "116px" });

    // The only big (72px) buttons on the sketch tab are Sketch and Dimension.
    const sketch = screen.getByRole("button", { name: "Sketch" });
    expect(sketch).toHaveStyle({ width: "72px" });
    const dimension = screen.getByRole("button", { name: "Dimension" });
    expect(dimension).toHaveStyle({ width: "72px" });
  });

  it("Dimension button is disabled until a sketch is active, then selects DIMENSION", async () => {
    const onOperationSelect = vi.fn();
    const { rerender } = renderWithProviders(
      <OperationsBar {...defaultProps} onOperationSelect={onOperationSelect} />,
    );

    expect(screen.getByRole("button", { name: "Dimension" })).toBeDisabled();

    rerender(
      <OperationsBar {...defaultProps} activeSketchId="s1" onOperationSelect={onOperationSelect} />,
    );

    const dimension = screen.getByRole("button", { name: "Dimension" });
    expect(dimension).toBeEnabled();
    await userEvent.click(dimension);
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.DIMENSION);
  });

  it("selects the operation when a stacked group body is clicked", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationsBar {...defaultProps} onOperationSelect={onOperationSelect} />,
    );

    await userEvent.click(screen.getByText("Line"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.LINE);

    await userEvent.click(screen.getByText("Corner Rectangle"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.RECTANGLE);
  });
});
