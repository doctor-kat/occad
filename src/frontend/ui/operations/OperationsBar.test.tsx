import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { OperationsBar } from "./OperationsBar";
import { OperationCategory, SketchOperation } from "@/cad/types";

describe("OperationsBar — sketch tab", () => {
  const defaultProps = {
    activeTab: OperationCategory.SKETCH,
    activeOperation: null,
    onTabChange: vi.fn(),
    onOperationSelect: vi.fn(),
    onSketchButtonClick: vi.fn(),
  };

  it("renders Line and Rectangle as stacked compact buttons", () => {
    renderWithProviders(<OperationsBar {...defaultProps} />);

    const line = screen.getByText("Line").closest("button");
    const rectangle = screen.getByText("Rectangle").closest("button");

    expect(line).toBeInTheDocument();
    expect(rectangle).toBeInTheDocument();

    // Compact buttons are the narrow horizontal variant (116px) rather than the
    // 72px square button used for the other sketch operations.
    expect(line).toHaveStyle({ width: "116px" });
    expect(rectangle).toHaveStyle({ width: "116px" });
  });

  it("keeps other sketch operations as full square buttons", () => {
    renderWithProviders(<OperationsBar {...defaultProps} />);

    const circle = screen.getByText("Circle").closest("button");
    expect(circle).toHaveStyle({ width: "72px" });
  });

  it("selects the operation when a stacked button is clicked", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationsBar {...defaultProps} onOperationSelect={onOperationSelect} />,
    );

    await userEvent.click(screen.getByText("Line"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.LINE);

    await userEvent.click(screen.getByText("Rectangle"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.RECTANGLE);
  });
});
