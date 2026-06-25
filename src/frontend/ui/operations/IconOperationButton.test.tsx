import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { IconOperationButton } from "./IconOperationButton";
import { SketchOperation } from "@/cad/types";

describe("IconOperationButton", () => {
  const defaultProps = {
    icon: <span data-testid="icon">▬</span>,
    label: "Line",
    operationId: SketchOperation.LINE,
    isActive: false,
    onClick: vi.fn(),
  };

  it("renders the icon but not a visible text label", () => {
    renderWithProviders(<IconOperationButton {...defaultProps} />);

    expect(screen.getByTestId("icon")).toBeInTheDocument();
    // The label is exposed for a11y / tooltip, but never rendered as button text.
    expect(screen.queryByText("Line", { selector: "span:not([aria-hidden])" })).toBeNull();
  });

  it("exposes the label as an accessible name", () => {
    renderWithProviders(<IconOperationButton {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Line" })).toBeInTheDocument();
  });

  it("renders as a 34px square icon button", () => {
    renderWithProviders(<IconOperationButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "Line" });
    expect(button).toHaveStyle({ width: "34px", height: "34px" });
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    renderWithProviders(<IconOperationButton {...defaultProps} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Line" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <IconOperationButton {...defaultProps} onClick={onClick} disabled />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Line" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
