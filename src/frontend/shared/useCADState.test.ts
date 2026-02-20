import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCADState } from "./useCADState.ts";

describe("useCADState", () => {
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

    it("should have 1 default sketch (Sketch1 with rectangle)", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.project.sketches).toHaveLength(1);
      expect(result.current.project.sketches[0].name).toBe("Sketch1");
      expect(result.current.project.sketches[0].elements).toHaveLength(1);
      expect(result.current.project.sketches[0].elements[0].type).toBe(
        "rectangle",
      );
    });

    it("should have 1 default feature (Boss-Extrude1)", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.project.features).toHaveLength(1);
      expect(result.current.project.features[0].name).toBe("Boss-Extrude1");
      expect(result.current.project.features[0].type).toBe("extrude-boss");
    });

    it("should have version 1", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.project.version).toBe(1);
    });

    it("should have no active tool, sketch, or selection", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.activeTool).toBeNull();
      expect(result.current.activeSketchId).toBeNull();
      expect(result.current.selectedTreeItem).toBeNull();
    });

    it("should have 'features' as the default active tab", () => {
      const { result } = renderHook(() => useCADState());
      expect(result.current.activeTab).toBe("features");
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

    it("should clear selectedTreeItem and activeTool", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectTreeItem("front-plane");
        result.current.selectTool("line");
      });

      act(() => {
        result.current.newProject();
      });

      expect(result.current.selectedTreeItem).toBeNull();
      expect(result.current.activeTool).toBeNull();
    });
  });

  describe("addSketch()", () => {
    it("should add a sketch and increment version", () => {
      const { result } = renderHook(() => useCADState());
      const versionBefore = result.current.project.version;

      let newSketch;
      act(() => {
        newSketch = result.current.addSketch("Test Sketch", {
          type: "xy",
          planeRef: "front-plane",
          offset: 0,
        });
      });

      expect(result.current.project.sketches).toHaveLength(2);
      expect(result.current.project.version).toBe(versionBefore + 1);
      expect(newSketch).toHaveProperty("id");
      expect(newSketch).toHaveProperty("name", "Test Sketch");
    });
  });

  describe("startSketchEdit / stopSketchEdit", () => {
    it("should set activeSketchId and switch tab to sketch", () => {
      const { result } = renderHook(() => useCADState());
      const sketchId = result.current.project.sketches[0].id;

      act(() => {
        result.current.startSketchEdit(sketchId);
      });

      expect(result.current.activeSketchId).toBe(sketchId);
      expect(result.current.activeTab).toBe("sketch");
    });

    it("should clear activeSketchId on stopSketchEdit", () => {
      const { result } = renderHook(() => useCADState());
      const sketchId = result.current.project.sketches[0].id;

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
        result.current.addFeature("Test Feature", "extrude-boss", {
          distance: 10,
          isCut: false,
        });
      });

      expect(result.current.project.features).toHaveLength(2);
      expect(result.current.project.version).toBe(versionBefore + 1);
    });
  });

  describe("deleteTreeItem()", () => {
    it("should delete a sketch by ID", () => {
      const { result } = renderHook(() => useCADState());

      let newSketch;
      act(() => {
        newSketch = result.current.addSketch("To Delete", {
          type: "xy",
          planeRef: "front-plane",
          offset: 0,
        });
      });

      expect(result.current.project.sketches).toHaveLength(2);

      act(() => {
        result.current.deleteTreeItem(newSketch!.id);
      });

      expect(result.current.project.sketches).toHaveLength(1);
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

      let newSketch;
      act(() => {
        newSketch = result.current.addSketch("To Delete", {
          type: "xy",
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
          type: "xy",
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
      const featureId = result.current.project.features[0].id;

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
      const sketchId = result.current.project.sketches[0].id;

      // Default consumed sketch is hidden (isVisible: false)
      expect(result.current.project.sketches[0].isVisible).toBe(false);

      act(() => {
        result.current.toggleTreeItemVisibility(sketchId);
      });

      expect(result.current.project.sketches[0].isVisible).toBe(true);

      act(() => {
        result.current.toggleTreeItemVisibility(sketchId);
      });

      expect(result.current.project.sketches[0].isVisible).toBe(false);
    });

    it("should auto-hide sketch when consumed by addFeature", () => {
      const { result } = renderHook(() => useCADState());

      // Add a standalone sketch
      let newSketch: any;
      act(() => {
        newSketch = result.current.addSketch("Visible Sketch", {
          type: "xy",
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
          "extrude-boss",
          { distance: 10, isCut: false },
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

      // Default: feature visible, consumed sketch hidden
      const featureItem = result.current.featureTree.find(
        (i) => i.type === "feature",
      );
      expect(featureItem!.visible).toBe(true);
      expect(featureItem!.children![0].visible).toBe(false);
    });
  });

  describe("selectTool / switchTab", () => {
    it("should toggle tool on/off", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectTool("line");
      });
      expect(result.current.activeTool).toBe("line");

      act(() => {
        result.current.selectTool("line");
      });
      expect(result.current.activeTool).toBeNull();
    });

    it("should switch between tools", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectTool("line");
      });
      act(() => {
        result.current.selectTool("circle");
      });
      expect(result.current.activeTool).toBe("circle");
    });

    it("should clear active tool when switching tabs", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.selectTool("line");
      });
      act(() => {
        result.current.switchTab("sketch");
      });

      expect(result.current.activeTool).toBeNull();
      expect(result.current.activeTab).toBe("sketch");
    });
  });

  describe("localStorage persistence", () => {
    it("should persist project to localStorage", () => {
      const { result } = renderHook(() => useCADState());

      act(() => {
        result.current.addSketch("Persisted Sketch", {
          type: "xy",
          planeRef: "front-plane",
          offset: 0,
        });
      });

      const stored = JSON.parse(
        localStorage.getItem("occad-project") || "{}",
      );
      expect(stored.sketches).toHaveLength(2);
      expect(stored.sketches[1].name).toBe("Persisted Sketch");
    });

    it("should restore from localStorage on re-render", () => {
      const { result, unmount } = renderHook(() => useCADState());

      act(() => {
        result.current.addSketch("Restored Sketch", {
          type: "xy",
          planeRef: "front-plane",
          offset: 0,
        });
      });

      const projectId = result.current.project.id;
      unmount();

      // Re-render — should load from localStorage
      const { result: result2 } = renderHook(() => useCADState());
      expect(result2.current.project.id).toBe(projectId);
      expect(result2.current.project.sketches).toHaveLength(2);
    });
  });
});
