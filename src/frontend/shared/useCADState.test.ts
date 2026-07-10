import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCADState } from "./useCADState.ts";
import { createConstraint } from "@/cad/engine/sketch/constraintFactory";
import { SketchElementType } from "@/cad/types/sketch/SketchElementType";
import type { SketchElement } from "@/cad/types/sketch/SketchElement";
import type { Sketch } from "@/cad/types/sketch/Sketch";
import { compareBuildOrder } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";

describe("useCADState", () => {
  // selectedTreeItem is backed by viewportStore (a module-level singleton), so
  // it must be reset between tests the same way cadLayoutUiStore is reset in
  // CADLayout.test.tsx — otherwise a selection made in one test leaks into the
  // next test's initial render.
  beforeEach(() => {
    useViewportStore.setState({ selectedTreeItem: null });
  });

  describe("initial state", () => {
    it("should have project name 'Untitled Project'", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.project.name).toBe("Untitled Project");
    });

    it("should have 4 reference geometry items", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.project.referenceGeometry).toHaveLength(4);
      const names = result.current.project.referenceGeometry.map(
        (r) => r.name,
      );
      expect(names).toEqual([
        "Front Plane",
        "Top Plane",
        "Right Plane",
        "Origin",
      ]);
    });

    it("should have 0 default sketches", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.project.sketches).toHaveLength(0);
    });

    it("should have 0 default features", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.project.features).toHaveLength(0);
    });

    it("should have version 1", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.project.version).toBe(1);
    });

    it("should have no active operation, sketch, or selection", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.activeOperation).toBeNull();
      expect(result.current.activeSketchId).toBeNull();
      expect(result.current.selectedTreeItem).toBeNull();
    });

    it("should have 'primitives' as the default active tab", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.activeTab).toBe("primitives");
    });
  });

  describe("newProject()", () => {
    it("should reset to a fresh project with a new ID", () => {
      const { result } = renderHook(() => useCADState());
      const oldId = result.current.project.id;

      act(() => {
        result.current.newProject();
      });

      expect(result.current.project.id).not.toBe(oldId);
      expect(result.current.project.name).toBe("Untitled Project");
      expect(result.current.project.version).toBe(1);
    });

    it("should clear selectedTreeItem and activeOperation", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectTreeItem("front-plane");
        result.current.selectOperation("line" as any);
      });

      act(() => {
        result.current.newProject();
      });

      expect(result.current.selectedTreeItem).toBeNull();
      expect(result.current.activeOperation).toBeNull();
    });
  });

  describe("addSketch()", () => {
    it("should add a sketch and increment version", () => {
      const { result } = renderHook(() => useCADState());
      const versionBefore = result.current.project.version;

      let newSketch;
      act(() => {
        newSketch = result.current.addSketch("Test Sketch", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
      });

      expect(result.current.project.sketches).toHaveLength(1);
      expect(result.current.project.version).toBe(versionBefore + 1);
      expect(newSketch).toHaveProperty("id");
      expect(newSketch).toHaveProperty("name", "Test Sketch");
    });
  });

  describe("startSketchEdit / stopSketchEdit", () => {
    it("should set activeSketchId and switch tab to sketch", () => {
      const { result } = renderHook(() => useCADState());
      let sketchId: string;
      
      act(() => {
        const newSketch = result.current.addSketch("Test Sketch", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
        sketchId = newSketch.id;
      });

      act(() => {
        result.current.startSketchEdit(sketchId);
      });

      expect(result.current.activeSketchId).toBe(sketchId);
      expect(result.current.activeTab).toBe("sketch");
    });

    it("should clear activeSketchId on stopSketchEdit", () => {
      const { result } = renderHook(() => useCADState());
      let sketchId: string;

      act(() => {
        const newSketch = result.current.addSketch("Test Sketch", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
        sketchId = newSketch.id;
      });

      act(() => {
        result.current.startSketchEdit(sketchId);
      });
      act(() => {
        result.current.stopSketchEdit();
      });

      expect(result.current.activeSketchId).toBeNull();
    });
  });

  describe("selectTreeItem()", () => {
    it("should select an item by ID", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectTreeItem("front-plane");
      });

      expect(result.current.selectedTreeItem).toBe("front-plane");
    });

    it("should toggle off when clicking the same item", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectTreeItem("front-plane");
      });
      act(() => {
        result.current.selectTreeItem("front-plane");
      });

      expect(result.current.selectedTreeItem).toBeNull();
    });

    it("should switch when clicking a different item", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectTreeItem("front-plane");
      });
      act(() => {
        result.current.selectTreeItem("top-plane");
      });

      expect(result.current.selectedTreeItem).toBe("top-plane");
    });
  });

  describe("addFeature()", () => {
    it("should add a feature and increment version", () => {
      const { result } = renderHook(() => useCADState());
      const versionBefore = result.current.project.version;

      act(() => {
        result.current.addFeature("Test Feature", "extrude-boss" as any, {
          distance: 10,
          isCut: false,
        } as any);
      });

      expect(result.current.project.features).toHaveLength(1);
      expect(result.current.project.version).toBe(versionBefore + 1);
    });
  });

  describe("deleteTreeItem()", () => {
    it("should delete a sketch by ID", () => {
      const { result } = renderHook(() => useCADState());

      let newSketch: any;
      act(() => {
        newSketch = result.current.addSketch("To Delete", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
      });

      expect(result.current.project.sketches).toHaveLength(1);

      act(() => {
        result.current.deleteTreeItem(newSketch!.id);
      });

      expect(result.current.project.sketches).toHaveLength(0);
    });

    it("should not delete reference geometry", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.deleteTreeItem("front-plane");
      });

      expect(result.current.project.referenceGeometry).toHaveLength(4);
    });

    it("should clear selection if the deleted item was selected", () => {
      const { result } = renderHook(() => useCADState());

      let newSketch: any;
      act(() => {
        newSketch = result.current.addSketch("To Delete", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
      });

      act(() => {
        result.current.selectTreeItem(newSketch!.id);
      });

      expect(result.current.selectedTreeItem).toBe(newSketch!.id);

      act(() => {
        result.current.deleteTreeItem(newSketch!.id);
      });

      expect(result.current.selectedTreeItem).toBeNull();
    });
  });

  describe("featureTree (computed)", () => {
    it("should have reference geometry at top level", () => {
      const { result } = renderHook(() => useCADState());
      const refItems = result.current.featureTree.filter(
        (i) => i.type === "reference-geometry",
      );
      expect(refItems).toHaveLength(4);
    });

    it("should nest sketch under parent feature", () => {
      const { result } = renderHook(() => useCADState());
      
      let sketch: any;
      act(() => {
        sketch = result.current.addSketch("Sketch", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
        result.current.addFeature("Feature", "extrude-boss" as any, { distance: 10, isCut: false } as any, sketch.id, [sketch.id]);
      });

      const featureItem = result.current.featureTree.find(
        (i) => i.type === "feature",
      );
      expect(featureItem).toBeDefined();
      expect(featureItem!.children).toHaveLength(1);
      expect(featureItem!.children![0].type).toBe("sketch");
    });

    it("should show standalone sketches at top level", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.addSketch("Standalone", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
      });

      const topLevelSketches = result.current.featureTree.filter(
        (i) => i.type === "sketch",
      );
      expect(topLevelSketches).toHaveLength(1);
      expect(topLevelSketches[0].name).toBe("Standalone");
    });
  });

  describe("visibility toggling", () => {
    it("should toggle feature isVisible correctly", () => {
      const { result } = renderHook(() => useCADState());
      let featureId: string;

      act(() => {
        const feature = result.current.addFeature("Feature", "extrude-boss" as any, { distance: 10, isCut: false } as any);
        featureId = feature.id;
      });

      // Default feature is visible
      expect(result.current.project.features[0].isVisible).toBe(true);

      act(() => {
        result.current.toggleTreeItemVisibility(featureId);
      });

      expect(result.current.project.features[0].isVisible).toBe(false);

      act(() => {
        result.current.toggleTreeItemVisibility(featureId);
      });

      expect(result.current.project.features[0].isVisible).toBe(true);
    });

    it("should toggle sketch isVisible correctly", () => {
      const { result } = renderHook(() => useCADState());
      let sketchId: string;

      act(() => {
        const sketch = result.current.addSketch("Sketch", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
        sketchId = sketch.id;
      });

      // Standalone sketch is visible (isVisible: true)
      expect(result.current.project.sketches[0].isVisible).toBe(true);

      act(() => {
        result.current.toggleTreeItemVisibility(sketchId);
      });

      expect(result.current.project.sketches[0].isVisible).toBe(false);

      act(() => {
        result.current.toggleTreeItemVisibility(sketchId);
      });

      expect(result.current.project.sketches[0].isVisible).toBe(true);
    });

    it("should auto-hide sketch when consumed by addFeature", () => {
      const { result } = renderHook(() => useCADState());

      // Add a standalone sketch
      let newSketch: any;
      act(() => {
        newSketch = result.current.addSketch("Visible Sketch", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
      });

      // New sketch should be visible by default
      const sketch = result.current.project.sketches.find(
        (s) => s.id === newSketch.id,
      );
      expect(sketch!.isVisible).toBe(true);

      // Add a feature that consumes this sketch
      act(() => {
        result.current.addFeature(
          "Extrude",
          "extrude-boss" as any,
          { distance: 10, isCut: false } as any,
          newSketch.id,
          [newSketch.id],
        );
      });

      // Sketch should now be hidden
      const updatedSketch = result.current.project.sketches.find(
        (s) => s.id === newSketch.id,
      );
      expect(updatedSketch!.isVisible).toBe(false);
    });

    it("feature tree reflects visibility for features and consumed sketches", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        const sketch = result.current.addSketch("Sketch", { type: "xy" as any, planeRef: "front-plane", offset: 0 });
        result.current.addFeature("Feature", "extrude-boss" as any, { distance: 10, isCut: false } as any, sketch.id, [sketch.id]);
      });

      // Feature visible, consumed sketch hidden
      const featureItem = result.current.featureTree.find(
        (i) => i.type === "feature",
      );
      expect(featureItem!.visible).toBe(true);
      expect(featureItem!.children![0].visible).toBe(false);
    });
  });

  describe("addConstraint / removeConstraint", () => {
    function makeSketch(result: { current: ReturnType<typeof useCADState> }): string {
      let id = "";
      act(() => {
        const s = result.current.addSketch("Sketch", { type: "xy" as any, planeRef: "front-plane", offset: 0 });
        id = s.id;
      });
      return id;
    }

    it("appends a constraint to the sketch and increments version", () => {
      const { result } = renderHook(() => useCADState());
      const sketchId = makeSketch(result);
      const versionBefore = result.current.project.version;

      act(() => {
        result.current.addConstraint(sketchId, createConstraint("c1", { kind: "horizontal", lineId: "L" }));
      });

      const sketch = result.current.project.sketches.find((s) => s.id === sketchId)!;
      expect(sketch.constraints).toHaveLength(1);
      expect(sketch.constraints[0]).toMatchObject({ id: "c1", type: "horizontal_l", l_id: "L" });
      expect(result.current.project.version).toBe(versionBefore + 1);
    });

    it("is a no-op for an unknown sketch id", () => {
      const { result } = renderHook(() => useCADState());
      makeSketch(result);
      const versionBefore = result.current.project.version;

      act(() => {
        result.current.addConstraint("does-not-exist", createConstraint("c1", { kind: "vertical", lineId: "L" }));
      });

      expect(result.current.project.version).toBe(versionBefore);
    });

    it("removes a constraint by id and increments version", () => {
      const { result } = renderHook(() => useCADState());
      const sketchId = makeSketch(result);

      act(() => {
        result.current.addConstraint(sketchId, createConstraint("c1", { kind: "horizontal", lineId: "L" }));
        result.current.addConstraint(sketchId, createConstraint("c2", { kind: "vertical", lineId: "M" }));
      });
      const versionBefore = result.current.project.version;

      act(() => {
        result.current.removeConstraint(sketchId, "c1");
      });

      const sketch = result.current.project.sketches.find((s) => s.id === sketchId)!;
      expect(sketch.constraints.map((c: any) => c.id)).toEqual(["c2"]);
      expect(result.current.project.version).toBe(versionBefore + 1);
    });
  });

  describe("sketch closure (isClosed)", () => {
    const rectElement: SketchElement = {
      type: SketchElementType.RECTANGLE,
      id: "rect-1",
      corner1: { x: 0, y: 0 },
      corner2: { x: 10, y: 10 },
    } as SketchElement;

    function makeRectSketch(result: { current: ReturnType<typeof useCADState> }): string {
      let id = "";
      act(() => {
        const s = result.current.addSketch("Rect Sketch", { type: "xy" as any, planeRef: "top-plane", offset: 0 });
        id = s.id;
      });
      act(() => {
        result.current.updateSketchElements(id, [rectElement]);
      });
      return id;
    }

    it("marks a rectangle sketch as closed via updateSketchElements", () => {
      const { result } = renderHook(() => useCADState());
      const sketchId = makeRectSketch(result);

      const sketch = result.current.project.sketches.find((s) => s.id === sketchId)!;
      expect(sketch.isClosed).toBe(true);
    });

    it("keeps isClosed=true after a solver round-trip via updateSketchState", () => {
      const { result } = renderHook(() => useCADState());
      const sketchId = makeRectSketch(result);

      // Simulate the worker returning a solved sketch that carries a stale
      // isClosed=false (SketchSolver spreads back the input sketch verbatim).
      const solved: Sketch = {
        ...result.current.project.sketches.find((s) => s.id === sketchId)!,
        isClosed: false,
      };

      act(() => {
        result.current.updateSketchState(sketchId, solved);
      });

      const sketch = result.current.project.sketches.find((s) => s.id === sketchId)!;
      expect(sketch.isClosed).toBe(true);
    });

    it("keeps an empty sketch open after updateSketchState", () => {
      const { result } = renderHook(() => useCADState());
      let sketchId = "";
      act(() => {
        const s = result.current.addSketch("Empty", { type: "xy" as any, planeRef: "top-plane", offset: 0 });
        sketchId = s.id;
      });

      const solved: Sketch = {
        ...result.current.project.sketches.find((s) => s.id === sketchId)!,
        isClosed: true, // even if a stale truthy value comes back
      };

      act(() => {
        result.current.updateSketchState(sketchId, solved);
      });

      const sketch = result.current.project.sketches.find((s) => s.id === sketchId)!;
      expect(sketch.isClosed).toBe(false);
    });
  });

  describe("sketch workplane normals", () => {
    // The extrude direction defaults to the sketch's plane normal. If these
    // normals are wrong, a rectangle on the Top/Right plane extrudes flat.
    it("gives an XY (Front Plane) sketch a +Z normal", () => {
      const { result } = renderHook(() => useCADState());
      let s: any;
      act(() => {
        s = result.current.addSketch("Front", { type: "xy" as any, planeRef: "front-plane", offset: 0 });
      });
      expect(s.workplane.normal).toEqual({ x: 0, y: 0, z: 1 });
    });

    it("gives an XZ (Top Plane) sketch a -Y normal (right-handed with X/Z axes)", () => {
      const { result } = renderHook(() => useCADState());
      let s: any;
      act(() => {
        s = result.current.addSketch("Top", { type: "xz" as any, planeRef: "top-plane", offset: 0 });
      });
      expect(s.workplane.normal).toEqual({ x: 0, y: -1, z: 0 });
    });

    it("gives a YZ (Right Plane) sketch a +X normal", () => {
      const { result } = renderHook(() => useCADState());
      let s: any;
      act(() => {
        s = result.current.addSketch("Right", { type: "yz" as any, planeRef: "right-plane", offset: 0 });
      });
      expect(s.workplane.normal).toEqual({ x: 1, y: 0, z: 0 });
    });
  });

  describe("selectOperation / switchTab", () => {
    it("should toggle operation on/off", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectOperation("line" as any);
      });
      expect(result.current.activeOperation).toBe("line");

      act(() => {
        result.current.selectOperation("line" as any);
      });
      expect(result.current.activeOperation).toBeNull();
    });

    it("should switch between operations", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectOperation("line" as any);
      });
      act(() => {
        result.current.selectOperation("circle" as any);
      });
      expect(result.current.activeOperation).toBe("circle");
    });

    it("should clear active operation when switching tabs", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectOperation("line" as any);
      });
      act(() => {
        result.current.switchTab("sketch" as any);
      });

      expect(result.current.activeOperation).toBeNull();
      expect(result.current.activeTab).toBe("sketch");
    });
  });

  describe("localStorage persistence", () => {
    it("should persist project to localStorage", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.addSketch("Persisted Sketch", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
      });

      const stored = JSON.parse(
        localStorage.getItem("occad-project") || "{}",
      );
      expect(stored.sketches).toHaveLength(1);
      expect(stored.sketches[0].name).toBe("Persisted Sketch");
    });

    it("should restore from localStorage on re-render", () => {
      const { result, unmount } = renderHook(() => useCADState());

      act(() => {
        result.current.addSketch("Restored Sketch", {
          type: "xy" as any,
          planeRef: "front-plane",
          offset: 0,
        });
      });

      const projectId = result.current.project.id;
      unmount();

      // Re-render — should load from localStorage
      const { result: result2 } = renderHook(() => useCADState());
      expect(result2.current.project.id).toBe(projectId);
      expect(result2.current.project.sketches).toHaveLength(1);
    });
  });
});

/**
 * Determinism: the feature tree order and the worker rebuild order must agree,
 * be stable under same-millisecond ties, and actually respond to reordering.
 * (reorderFeature used to be a no-op because both layers sort by orderKey while
 * it only reordered the array.)
 */
describe("useCADState — deterministic build order", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // Names of top-level FEATURE tree items, in displayed order.
  function featureOrder(result: { current: ReturnType<typeof useCADState> }): string[] {
    return result.current.featureTree
      .filter((i) => i.type === "feature")
      .map((i) => i.name);
  }

  function addThreeFeatures() {
    const { result } = renderHook(() => useCADState());
    const ids: Record<string, string> = {};
    act(() => {
      vi.setSystemTime(1000);
      ids.A = result.current.addFeature("A", "box" as any).id;
    });
    act(() => {
      vi.setSystemTime(2000);
      ids.B = result.current.addFeature("B", "box" as any).id;
    });
    act(() => {
      vi.setSystemTime(3000);
      ids.C = result.current.addFeature("C", "box" as any).id;
    });
    return { result, ids };
  }

  it("lists features in creation order before any reorder", () => {
    const { result } = addThreeFeatures();
    expect(featureOrder(result)).toEqual(["A", "B", "C"]);
  });

  it("moves a feature to the front (and the tree reflects it)", () => {
    const { result, ids } = addThreeFeatures();
    act(() => result.current.reorderFeature(ids.C, 0));
    expect(featureOrder(result)).toEqual(["C", "A", "B"]);
  });

  it("moves a feature to the middle", () => {
    const { result, ids } = addThreeFeatures();
    act(() => result.current.reorderFeature(ids.A, 1));
    expect(featureOrder(result)).toEqual(["B", "A", "C"]);
  });

  it("worker build order (compareBuildOrder) matches the tree after a reorder", () => {
    const { result, ids } = addThreeFeatures();
    act(() => result.current.reorderFeature(ids.C, 0));

    const treeNames = featureOrder(result);
    const workerNames = [...result.current.project.features]
      .sort(compareBuildOrder)
      .map((f) => f.name);
    expect(workerNames).toEqual(treeNames);
    expect(workerNames).toEqual(["C", "A", "B"]);
  });

  it("bumps project.version so the reorder triggers a rebuild", () => {
    const { result, ids } = addThreeFeatures();
    const before = result.current.project.version;
    act(() => result.current.reorderFeature(ids.C, 0));
    expect(result.current.project.version).toBeGreaterThan(before);
  });

  // Drag-and-drop reorder: drop the dragged feature before/after a target.
  it("reorderFeatureRelative: drops a feature before a target", () => {
    const { result, ids } = addThreeFeatures();
    act(() => result.current.reorderFeatureRelative(ids.C, ids.A, "before"));
    expect(featureOrder(result)).toEqual(["C", "A", "B"]);
  });

  it("reorderFeatureRelative: drops a feature after a target", () => {
    const { result, ids } = addThreeFeatures();
    act(() => result.current.reorderFeatureRelative(ids.A, ids.C, "after"));
    expect(featureOrder(result)).toEqual(["B", "C", "A"]);
  });

  it("reorderFeatureRelative: dropping a feature onto itself is a no-op", () => {
    const { result, ids } = addThreeFeatures();
    const before = result.current.project.version;
    act(() => result.current.reorderFeatureRelative(ids.B, ids.B, "before"));
    expect(featureOrder(result)).toEqual(["A", "B", "C"]);
    expect(result.current.project.version).toBe(before);
  });

  it("applyRefEnrichments persists fingerprinted refs WITHOUT bumping version", () => {
    const { result } = renderHook(() => useCADState());
    let filletId = "";
    act(() => {
      filletId = result.current.addFeature("Fillet", "fillet" as any, {
        radius: 2,
        edges: ["edge-3"],
      } as any).id;
    });

    const versionBefore = result.current.project.version;
    const enrichedRef = {
      kind: "edge" as const,
      index: 3,
      fingerprint: {
        kind: "edge" as const,
        index: 3,
        geomType: "line",
        measure: 10,
        centroid: { x: 0, y: 0, z: 5 },
        obb: [0, 0, 5] as [number, number, number],
      },
    };

    act(() =>
      result.current.applyRefEnrichments([
        { featureId: filletId, key: "edges", refs: [enrichedRef] },
      ])
    );

    const feature = result.current.project.features.find((f) => f.id === filletId)!;
    expect((feature.parameters as any).edges[0]).toEqual(enrichedRef);
    // Derived enrichment — must not trigger another rebuild.
    expect(result.current.project.version).toBe(versionBefore);
  });

  it("applyRefEnrichments is a no-op for an unknown feature id", () => {
    const { result } = renderHook(() => useCADState());
    act(() => {
      result.current.addFeature("Fillet", "fillet" as any, { radius: 2, edges: ["edge-0"] } as any);
    });
    const projectBefore = result.current.project;
    act(() =>
      result.current.applyRefEnrichments([
        { featureId: "does-not-exist", key: "edges", refs: ["edge-1"] },
      ])
    );
    // Same reference back (no churn) when nothing matched.
    expect(result.current.project).toBe(projectBefore);
  });

  it("applySketchRefEnrichments persists sourceRef on a primitive WITHOUT bumping version", () => {
    const { result } = renderHook(() => useCADState());
    let sketchId = "";
    act(() => {
      sketchId = result.current.addSketch("S", { type: "xy" } as any).id;
    });
    // Give the sketch an external primitive anchored by a bare positional tag.
    act(() => {
      const sketch = result.current.project.sketches.find((s) => s.id === sketchId)!;
      result.current.updateSketchState(sketchId, {
        ...sketch,
        primitives: [
          { id: "p1", type: "point", data: { x: 0, y: 0 }, fixed: true, isExternal: true, sourceId: "vertex-2" } as any,
        ],
      });
    });

    const versionBefore = result.current.project.version;
    const ref = {
      kind: "vertex" as const,
      index: 2,
      fingerprint: {
        kind: "vertex" as const,
        index: 2,
        geomType: "point",
        measure: 0,
        centroid: { x: 10, y: 10, z: 0 },
        obb: [0, 0, 0] as [number, number, number],
      },
    };

    act(() =>
      result.current.applySketchRefEnrichments([
        { sketchId, primitiveId: "p1", ref },
      ])
    );

    const sketch = result.current.project.sketches.find((s) => s.id === sketchId)!;
    expect((sketch.primitives[0] as any).sourceRef).toEqual(ref);
    // Derived enrichment — must not trigger another rebuild.
    expect(result.current.project.version).toBe(versionBefore);
  });

  it("applySketchRefEnrichments is a no-op for an unknown sketch id", () => {
    const { result } = renderHook(() => useCADState());
    act(() => {
      result.current.addSketch("S", { type: "xy" } as any);
    });
    const projectBefore = result.current.project;
    act(() =>
      result.current.applySketchRefEnrichments([
        { sketchId: "does-not-exist", primitiveId: "p1", ref: { kind: "vertex", index: 0 } },
      ])
    );
    // Same reference back (no churn) when nothing matched.
    expect(result.current.project).toBe(projectBefore);
  });

  // Snapshot undo/redo (step 4). All model edits funnel through one immutable
  // setProject and bump `version`; the history layer records a snapshot per
  // version change and replays it, while derived/no-version-bump updates
  // (enrichments) are intentionally invisible to undo.
  describe("undo/redo", () => {
    const boxParams = { width: 1, height: 1, depth: 1 } as any;

    it("starts with nothing to undo or redo", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it("undo restores the state before the last model edit; redo re-applies it", () => {
      const { result } = renderHook(() => useCADState());
      act(() => {
        result.current.addFeature("Box", "box" as any, boxParams);
      });
      expect(result.current.project.features).toHaveLength(1);
      expect(result.current.canUndo).toBe(true);
      const builtVersion = result.current.project.version;

      act(() => result.current.undo());
      expect(result.current.project.features).toHaveLength(0);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);

      act(() => result.current.redo());
      expect(result.current.project.features).toHaveLength(1);
      expect(result.current.project.version).toBe(builtVersion);
      expect(result.current.canRedo).toBe(false);
    });

    it("steps back through multiple edits in LIFO order", () => {
      const { result } = renderHook(() => useCADState());
      act(() => {
        result.current.addFeature("Box", "box" as any, boxParams);
      });
      act(() => {
        result.current.addFeature("Cyl", "cylinder" as any, { radius: 1, height: 1 } as any);
      });
      expect(result.current.project.features.map((f) => f.name)).toEqual(["Box", "Cyl"]);

      act(() => result.current.undo());
      expect(result.current.project.features.map((f) => f.name)).toEqual(["Box"]);
      act(() => result.current.undo());
      expect(result.current.project.features).toHaveLength(0);
    });

    it("a new model edit after an undo clears the redo stack", () => {
      const { result } = renderHook(() => useCADState());
      act(() => {
        result.current.addFeature("Box", "box" as any, boxParams);
      });
      act(() => result.current.undo());
      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.addFeature("Cyl", "cylinder" as any, { radius: 1, height: 1 } as any);
      });
      expect(result.current.canRedo).toBe(false);
      expect(result.current.project.features.map((f) => f.name)).toEqual(["Cyl"]);
    });

    it("does not record a redo entry for the undo itself (no runaway stack)", () => {
      const { result } = renderHook(() => useCADState());
      act(() => {
        result.current.addFeature("Box", "box" as any, boxParams);
      });
      act(() => result.current.undo());
      // exactly one redo available, exactly nothing more to undo
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
      act(() => result.current.redo());
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it("ignores derived enrichments (no version bump) — undo skips straight past them", () => {
      const { result } = renderHook(() => useCADState());
      let filletId = "";
      act(() => {
        filletId = result.current.addFeature("Fillet", "fillet" as any, {
          radius: 2,
          edges: ["edge-0"],
        } as any).id;
      });
      const enrichedRef = {
        kind: "edge" as const,
        index: 0,
        fingerprint: {
          kind: "edge" as const,
          index: 0,
          geomType: "line",
          measure: 10,
          centroid: { x: 0, y: 0, z: 0 },
          obb: [0, 0, 5] as [number, number, number],
        },
      };
      act(() =>
        result.current.applyRefEnrichments([{ featureId: filletId, key: "edges", refs: [enrichedRef] }])
      );
      // The enrichment was not a user edit, so a single undo removes the fillet.
      act(() => result.current.undo());
      expect(result.current.project.features).toHaveLength(0);
      expect(result.current.canUndo).toBe(false);
    });

    it("undo and redo are safe no-ops when their stacks are empty", () => {
      const { result } = renderHook(() => useCADState());
      const before = result.current.project;
      act(() => {
        result.current.undo();
        result.current.redo();
      });
      expect(result.current.project).toBe(before);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  it("never reorders a feature before its own consumed sketch", () => {
    const { result } = renderHook(() => useCADState());
    let extrudeId = "";
    let sketchId = "";

    act(() => {
      vi.setSystemTime(1000);
      result.current.addFeature("Plain", "box" as any);
    });
    act(() => {
      vi.setSystemTime(2000);
      sketchId = result.current.addSketch("Sketch", {
        type: "xy" as any,
        planeRef: "front-plane",
        offset: 0,
      }).id;
    });
    act(() => {
      vi.setSystemTime(3000);
      extrudeId = result.current.addFeature(
        "Extrude",
        "extrude-boss" as any,
        { distance: 10, isCut: false } as any,
        sketchId
      ).id;
    });

    // Yank the extrude to the very front — before its sketch.
    act(() => result.current.reorderFeature(extrudeId, 0));

    const sketch = result.current.project.sketches.find((s) => s.id === sketchId)!;
    const extrude = result.current.project.features.find((f) => f.id === extrudeId)!;
    // Build order must still place the sketch before the feature that consumes it.
    expect(compareBuildOrder(sketch, extrude)).toBeLessThan(0);
  });
});

/**
 * History rollback bar (ROADMAP.md §8): a non-destructive marker that rewinds
 * the build to only the features above it. Distinct from suppress/undo.
 */
describe("useCADState — history rollback bar", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  function addThreeFeatures() {
    const { result } = renderHook(() => useCADState());
    const ids: Record<string, string> = {};
    act(() => { vi.setSystemTime(1000); ids.A = result.current.addFeature("A", "box" as any).id; });
    act(() => { vi.setSystemTime(2000); ids.B = result.current.addFeature("B", "box" as any).id; });
    act(() => { vi.setSystemTime(3000); ids.C = result.current.addFeature("C", "box" as any).id; });
    return { result, ids };
  }

  const rolledBackNames = (result: { current: ReturnType<typeof useCADState> }) =>
    result.current.featureTree.filter((i) => i.rolledBack).map((i) => i.name);

  it("starts with the bar at the bottom (nothing rolled back)", () => {
    const { result } = addThreeFeatures();
    expect(result.current.rollbackBarIndex).toBe(3);
    expect(rolledBackNames(result)).toEqual([]);
    expect(result.current.project.rollbackBar).toBeUndefined();
  });

  it("rewinds: moving the bar up greys and skips the features below it", () => {
    const { result } = addThreeFeatures();
    act(() => result.current.moveRollbackBar(1)); // only A is present
    expect(result.current.rollbackBarIndex).toBe(1);
    expect(rolledBackNames(result)).toEqual(["B", "C"]);
  });

  it("fast-forwards: moving the bar back to the bottom clears the rollback", () => {
    const { result } = addThreeFeatures();
    act(() => result.current.moveRollbackBar(1));
    act(() => result.current.moveRollbackBar(3));
    expect(result.current.project.rollbackBar).toBeUndefined();
    expect(rolledBackNames(result)).toEqual([]);
  });

  it("bumps version so moving the bar triggers a rebuild", () => {
    const { result } = addThreeFeatures();
    const before = result.current.project.version;
    act(() => result.current.moveRollbackBar(2));
    expect(result.current.project.version).toBeGreaterThan(before);
  });

  it("inserts a new feature at the bar (present), not past it (hidden)", () => {
    const { result } = addThreeFeatures();
    act(() => result.current.moveRollbackBar(1)); // present: [A], rolled back: [B, C]
    let newId = "";
    act(() => { vi.setSystemTime(4000); newId = result.current.addFeature("D", "box" as any).id; });

    // D lands between A and B (present), and B/C stay rolled back after it.
    const order = [...result.current.project.features].sort(compareBuildOrder).map((f) => f.name);
    expect(order).toEqual(["A", "D", "B", "C"]);
    const dItem = result.current.featureTree.find((i) => i.id === newId)!;
    expect(dItem.rolledBack).toBe(false);
    expect(rolledBackNames(result)).toEqual(["B", "C"]);
  });
});
