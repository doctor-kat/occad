import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/helpers";
import { FeatureTree } from "./FeatureTree";
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
    selectedItem: null as string | null,
    onSelectItem: vi.fn(),
    onToggleExpand: vi.fn(),
    onToggleVisibility: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  it("should render all reference geometry names", () => {
    renderWithProviders(<FeatureTree {...defaultProps} />);
    expect(screen.getByText("Front Plane")).toBeInTheDocument();
    expect(screen.getByText("Top Plane")).toBeInTheDocument();
    expect(screen.getByText("Right Plane")).toBeInTheDocument();
    expect(screen.getByText("Origin")).toBeInTheDocument();
  });

  it("should render feature with child sketch when expanded", () => {
    renderWithProviders(<FeatureTree {...defaultProps} />);
    expect(screen.getByText("Boss-Extrude1")).toBeInTheDocument();
    expect(screen.getByText("Sketch1")).toBeInTheDocument();
  });

  it("should call onSelectItem when clicking an item name", async () => {
    const onSelectItem = vi.fn();
    renderWithProviders(
      <FeatureTree {...defaultProps} onSelectItem={onSelectItem} />,
    );

    await userEvent.click(screen.getByText("Front Plane"));
    expect(onSelectItem).toHaveBeenCalledWith("front-plane");
  });

  it("should hide text names in compact mode", () => {
    renderWithProviders(<FeatureTree {...defaultProps} isCompact />);
    expect(screen.queryByText("Feature Tree")).not.toBeInTheDocument();
    expect(screen.queryByText("Front Plane")).not.toBeInTheDocument();
  });
});
