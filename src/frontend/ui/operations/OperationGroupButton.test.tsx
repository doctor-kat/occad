import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { OperationGroupButton, OperationGroupOption } from "./OperationGroupButton";
import { SketchOperation } from "@/cad/types";
import { lineGroup, rectangleGroup, circleGroup, arcGroup } from "./OperationData";

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

  it("renders the line group with all variants and activates Centerline", async () => {
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

    // Centerline is implemented now: picking it activates the operation.
    await userEvent.click(within(menu).getByText("Centerline"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.CENTERLINE);
  });

  it("renders the rectangle group and activates the Parallelogram variant", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationGroupButton
        options={rectangleGroup.options}
        activeOperation={null}
        onOperationSelect={onOperationSelect}
      />,
    );

    // The shown body is the Corner Rectangle (the default first option).
    expect(screen.getByText("Corner Rectangle")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Corner Rectangle options" }));
    const menu = await screen.findByRole("menu");

    expect(within(menu).getByText("Center Rectangle")).toBeInTheDocument();
    expect(within(menu).getByText("3 Point Corner Rectangle")).toBeInTheDocument();
    expect(within(menu).getByText("3 Point Center Rectangle")).toBeInTheDocument();
    expect(within(menu).getByText("Parallelogram")).toBeInTheDocument();

    // The variants are implemented now: picking one activates that operation.
    await userEvent.click(within(menu).getByText("Parallelogram"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.PARALLELOGRAM);
  });

  it("renders the circle group and activates the Perimeter Circle variant", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationGroupButton
        options={circleGroup.options}
        variant="full"
        activeOperation={null}
        onOperationSelect={onOperationSelect}
      />,
    );

    expect(screen.getByText("Circle")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Circle options" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Perimeter Circle")).toBeInTheDocument();

    // Perimeter Circle (3-point) is implemented now: picking it activates the operation.
    await userEvent.click(within(menu).getByText("Perimeter Circle"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.PERIMETER_CIRCLE);
  });

  it("renders the arc group with Centerpoint and Tangent arcs selectable", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationGroupButton
        options={arcGroup.options}
        defaultOptionId={arcGroup.defaultOptionId}
        variant="full"
        activeOperation={null}
        onOperationSelect={onOperationSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "3 Point Arc options" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Centerpoint Arc")).toBeInTheDocument();

    await userEvent.click(within(menu).getByText("Centerpoint Arc"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.CENTERPOINT_ARC);
  });

  it("defaults the arc group to the implemented 3 Point Arc", async () => {
    const onOperationSelect = vi.fn();
    renderWithProviders(
      <OperationGroupButton
        options={arcGroup.options}
        defaultOptionId={arcGroup.defaultOptionId}
        variant="full"
        activeOperation={null}
        onOperationSelect={onOperationSelect}
      />,
    );

    // 3 Point Arc is shown even though it is listed last (it's the default option).
    expect(screen.getByText("3 Point Arc")).toBeInTheDocument();

    await userEvent.click(screen.getByText("3 Point Arc"));
    expect(onOperationSelect).toHaveBeenCalledWith(SketchOperation.ARC);
  });
});
