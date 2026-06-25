import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { OperationGroupButton, OperationGroupOption } from "./OperationGroupButton";
import { SketchOperation } from "@/cad/types";
import { lineGroup } from "./OperationData";

const enabledGroup: OperationGroupOption[] = [
  { id: SketchOperation.LINE, icon: <span>L</span>, label: "Line" },
  { id: SketchOperation.RECTANGLE, icon: <span>R</span>, label: "Rectangle" },
];

describe("OperationGroupButton", () => {
  it("shows the first option by default and activates it when the body is clicked", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationGroupButton
        options={enabledGroup}
        activeOperation={null}
        onOperationSelect={onOperationSelect}
      />,
    );

    // The visible body button shows "Line"; the dropdown isn't open so "Rectangle"
    // isn't in the DOM yet.
    expect(screen.getByText("Line")).toBeInTheDocument();
    expect(screen.queryByText("Rectangle")).toBeNull();

    await userEvent.click(screen.getByText("Line"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.LINE);
  });

  it("changes the shown option when a dropdown item is picked", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationGroupButton
        options={enabledGroup}
        activeOperation={null}
        onOperationSelect={onOperationSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Line options" }));
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByText("Rectangle"));

    // Picking from the dropdown both activates the option and changes the shown body.
    // The caret's accessible name tracks the shown option, so it now reads "Rectangle".
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.RECTANGLE);
    expect(
      await screen.findByRole("button", { name: "Rectangle options" }),
    ).toBeInTheDocument();
  });

  it("renders the line group with Centerline and Midpoint Line disabled", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationGroupButton
        options={lineGroup.options}
        activeOperation={null}
        onOperationSelect={onOperationSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Line options" }));
    const menu = await screen.findByRole("menu");

    expect(within(menu).getByText("Line")).toBeInTheDocument();
    expect(within(menu).getByText("Centerline")).toBeInTheDocument();
    expect(within(menu).getByText("Midpoint Line")).toBeInTheDocument();

    // Disabled options don't activate or change the shown body.
    await userEvent.click(within(menu).getByText("Centerline"));
    expect(onOperationSelect).not.toHaveBeenCalled();
  });
});
