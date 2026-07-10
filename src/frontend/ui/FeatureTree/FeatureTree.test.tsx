import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { FeatureTree } from "./FeatureTree";
import { FeatureTreeActionsProvider } from "./FeatureTreeActionsContext";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import type { FeatureTreeItem } from "@/cad/types";

const refGeometryItems: FeatureTreeItem[] = [
  {
    id: "front-plane",
    name: "Front Plane",
    type: "reference-geometry",
    visible: true,
    data: { id: "front-plane", name: "Front Plane", type: "plane" },
  },
  {
    id: "top-plane",
    name: "Top Plane",
    type: "reference-geometry",
    visible: true,
    data: { id: "top-plane", name: "Top Plane", type: "plane" },
  },
  {
    id: "right-plane",
    name: "Right Plane",
    type: "reference-geometry",
    visible: true,
    data: { id: "right-plane", name: "Right Plane", type: "plane" },
  },
  {
    id: "origin",
    name: "Origin",
    type: "reference-geometry",
    visible: true,
    data: { id: "origin", name: "Origin", type: "origin" },
  },
];

const featureWithChild: FeatureTreeItem = {
  id: "feature-1",
  name: "Boss-Extrude1",
  type: "feature",
  visible: true,
  isExpanded: true,
  children: [
    {
      id: "sketch-1",
      name: "Sketch1",
      type: "sketch",
      visible: true,
    },
  ],
};

describe("FeatureTree", () => {
  const defaultProps = {
    items: [...refGeometryItems, featureWithChild],
  };

  const onSelectItem = vi.fn();
  const onToggleExpand = vi.fn();
  const onToggleVisibility = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    onSelectItem.mockClear();
    onToggleExpand.mockClear();
    onToggleVisibility.mockClear();
    onEdit.mockClear();
    onDelete.mockClear();
    useViewportStore.setState({ selectedTreeItem: null });
  });

  function renderTree(props: React.ComponentProps<typeof FeatureTree>) {
    return renderWithProviders(
      <FeatureTreeActionsProvider value={{ onSelectItem, onToggleExpand, onToggleVisibility, onEdit, onDelete }}>
        <FeatureTree {...props} />
      </FeatureTreeActionsProvider>,
    );
  }

  it("should render all reference geometry names", () => {
    renderTree(defaultProps);
    expect(screen.getByText("Front Plane")).toBeInTheDocument();
    expect(screen.getByText("Top Plane")).toBeInTheDocument();
    expect(screen.getByText("Right Plane")).toBeInTheDocument();
    expect(screen.getByText("Origin")).toBeInTheDocument();
  });

  it("should render feature with child sketch when expanded", () => {
    renderTree(defaultProps);
    expect(screen.getByText("Boss-Extrude1")).toBeInTheDocument();
    expect(screen.getByText("Sketch1")).toBeInTheDocument();
  });

  it("should call onSelectItem when clicking an item name", async () => {
    renderTree(defaultProps);

    await userEvent.click(screen.getByText("Front Plane"));
    expect(onSelectItem).toHaveBeenCalledWith("front-plane");
  });

  it("should hide text names in compact mode", () => {
    renderTree({ ...defaultProps, isCompact: true });
    expect(screen.queryByText("Feature Tree")).not.toBeInTheDocument();
    expect(screen.queryByText("Front Plane")).not.toBeInTheDocument();
  });

  describe("history rollback bar", () => {
    const featureA: FeatureTreeItem = { id: "a", name: "A", type: "feature", visible: true };
    const featureB: FeatureTreeItem = { id: "b", name: "B", type: "feature", visible: true, rolledBack: true };
    const rollbackProps = {
      ...defaultProps,
      items: [...refGeometryItems, featureA, featureB],
      onMoveRollbackBar: vi.fn(),
      rollbackBarIndex: 1,
    };

    it("renders the rollback bar when a move handler is provided", () => {
      renderTree(rollbackProps);
      expect(screen.getByTestId("rollback-bar")).toBeInTheDocument();
    });

    it("does not render the bar without a move handler", () => {
      renderTree(defaultProps);
      expect(screen.queryByTestId("rollback-bar")).not.toBeInTheDocument();
    });

    it("marks a rolled-back row via data-rolled-back", () => {
      renderTree(rollbackProps);
      const rowB = screen.getByText("B").closest(".tree-item-row");
      const rowA = screen.getByText("A").closest(".tree-item-row");
      expect(rowB).toHaveAttribute("data-rolled-back", "true");
      expect(rowA).toHaveAttribute("data-rolled-back", "false");
    });
  });
});
