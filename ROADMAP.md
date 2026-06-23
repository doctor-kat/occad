# FEATURES.md

Tracking document for the goal of a **fully-featured OpenCascade CAD wrapper**: all primitives & features, a feature
tree, undo/redo history, and a constraint-based sketch solver.

Legend: ✅ Done & wired end-to-end · 🟡 Partial (types/UI exist but engine missing, or engine exists but no UI) · ❌ Not
started

> **How to read this:** "Engine" = handler in the Web Worker (`src/cad/engine/*`). "Rebuild" = handled in
`handleRebuild` for parametric history replay. "UI" = button/panel in `OperationsBar`/`OperationPanel`. A feature is
> only ✅ when types + engine + rebuild + UI all exist.

---

## Summary

| Area                       | Status | Done                                                | Partial         | Todo                             |
|----------------------------|--------|-----------------------------------------------------|-----------------|----------------------------------|
| **Sketch primitives**      | 🟡     | Line, Rectangle, Circle, Polygon, Arc, Ellipse      | Spline          | Bezier                           |
| **Sketch constraints**     | 🟡     | Solver (planegcs) wired; 8 typed interfaces defined | Typed↔solver gap | No add/edit UI; solver untested  |
| **Sketch-based features**  | ✅      | Extrude Boss/Cut, Revolve Boss/Cut                  | —               | —                                |
| **Primitives**             | 🟡     | Box, Cylinder                                       | —               | Sphere, Cone, Torus, Wedge       |
| **Boolean ops**            | 🟡     | Union, Subtract, Intersect (engine)                 | —               | UI for standalone booleans       |
| **Modifications**          | ❌      | —                                                   | UI + types only | Fillet, Chamfer, Shell, Offset   |
| **Transforms**             | ❌      | —                                                   | UI + types only | Move, Rotate, Mirror, Scale      |
| **Advanced modeling**      | ❌      | —                                                   | —               | Sweep, Loft                      |
| **Import / Export**        | ❌      | —                                                   | UI (disabled)   | STEP, IGES, STL, glTF, OBJ       |
| **Measurement / Analysis** | ❌      | —                                                   | Type only       | Measure, volume, area, CoM, bbox |
| **Feature tree**           | ✅      | Tree, reorder, suppress, visibility, edit           | —               | —                                |
| **Undo / Redo**            | ❌      | —                                                   | —               | History stack (not started)      |
| **Parametric rebuild**     | 🟡     | Sketch→extrude/revolve, box, cylinder, booleans     | —               | All non-wired feature types      |

**Overall:** Sketch + extrude/revolve + boolean pipeline is solid. The biggest gaps are **undo/redo**, **constraint
editing UI**, the **remaining primitives**, and the **modify/transform/IO** families (UI buttons exist but do nothing on
rebuild).

---

## 1. Sketch System

### 1.1 Sketch primitives

| Primitive | Type         | Builder (`sketchBuilders.ts`) | UI         | Status |
|-----------|--------------|-------------------------------|------------|--------|
| Point     | ✅            | ✅ `point`                     | ✅          | ✅      |
| Line      | ✅            | ✅ `line`                      | ✅          | ✅      |
| Rectangle | ✅            | ✅ (decomposed to lines)       | ✅          | ✅      |
| Circle    | ✅            | ✅ `circle`                    | ✅          | ✅      |
| Polygon   | ✅            | ✅ (decomposed to lines)       | ✅          | ✅      |
| Arc       | ✅            | ✅ `arc`                       | ✅          | ✅      |
| Ellipse   | ✅            | ✅ `ellipse`                   | ✅          | ✅      |
| Spline    | ✅            | 🟡 `GeomAPI_PointsToBSpline`  | ✅          | 🟡     |
| Bezier    | 🟡 type only | ❌                             | ✅ (button) | ❌      |

### 1.2 Sketch constraint solver

- ✅ **planegcs** (`@salusoft89/planegcs`) integrated in `SketchSolver.ts`, runs in the worker.
- ✅ Solver reports DOF, conflicting & redundant constraints (visual metadata).
- ✅ External-geometry reprojection onto a body (`sketch/externalGeometry.ts`).

Test column: ✅ = shape-only unit test (asserts object literal properties); none exercise the solver.

| Constraint    | Type defined | Test (shape) | Solver pass-through | Add/edit UI | Status |
|---------------|:------------:|:------------:|:-------------------:|:-----------:|--------|
| Fixed         |      ✅       |      ✅       |          ✅          |      ❌      | 🟡     |
| Coincident    |      ✅       |      ✅       |          ✅          |      ❌      | 🟡     |
| Horizontal    |      ✅       |      ✅       |          ✅          |      ❌      | 🟡     |
| Vertical      |      ✅       |      ✅       |          ✅          |      ❌      | 🟡     |
| Parallel      |      ✅       |      ✅       |          ✅          |      ❌      | 🟡     |
| Perpendicular |      ✅       |      ✅       |          ✅          |      ❌      | 🟡     |
| Distance      |      ✅       |      ✅       |          ✅          |      ❌      | 🟡     |
| Radius        |      ✅       |      ✅       |          ✅          |      ❌      | 🟡     |
| Tangent       |  ❌ enum only |      ❌       |          ✅          |      ❌      | ❌      |
| Midpoint      |      ❌       |      ❌       |          ❌          |      ❌      | ❌      |
| Equal         |      ❌       |      ❌       |          ❌          |      ❌      | ❌      |
| Symmetric     |      ❌       |      ❌       |          ❌          |      ❌      | ❌      |
| Angle         |      ❌       |      ❌       |          ❌          |      ❌      | ❌      |

**Key gaps:**

1. **Typed interfaces are orphaned.** The `SketchConstraint` interfaces in `src/cad/types/sketch/constraints/*.ts`
   (which reference `SketchElement` IDs) are imported **only by their own tests** — no app code uses them. The solver
   (`SketchSolver.ts`) consumes `sketch.constraints: any[]` in planegcs-native format (`p2p_distance`, `p1_id`, …)
   instead. There is **no converter** between the two, so "Solver pass-through" means raw planegcs objects pass through,
   not the typed constraints. Either build the typed→planegcs converter or drop the interface files.
2. **Solver is untested.** `SketchSolver.test.ts` fully mocks planegcs (returns empty primitives, status 0) and only
   asserts `updatedAt` changes — no test verifies a constraint actually drives geometry (distance sets distance,
   coincident merges points, etc.). The 8 constraint unit tests are shape-only.
3. **Tangent is enum only.** `SketchConstraintType.TANGENT` exists but there is no `TangentConstraint.ts` and no test.
4. **No add/edit UI** — no `addConstraint` anywhere in the frontend; no select-entities→apply-constraint flow.
5. Midpoint / equal / symmetric / angle are not modeled at all.

---

## 2. 3D Features

### 2.1 Sketch-based

| Feature      | Engine | Rebuild | Boolean combine | UI | Status |
|--------------|:------:|:-------:|:---------------:|:--:|--------|
| Extrude Boss |   ✅    |    ✅    |      union      | ✅  | ✅      |
| Extrude Cut  |   ✅    |    ✅    |    subtract     | ✅  | ✅      |
| Revolve Boss |   ✅    |    ✅    |      union      | ✅  | ✅      |
| Revolve Cut  |   ✅    |    ✅    |    subtract     | ✅  | ✅      |

### 2.2 Primitives

| Primitive | Params type |       Engine / Rebuild       | UI | Status |
|-----------|:-----------:|:----------------------------:|:--:|--------|
| Box       |      ✅      |   ✅ `BRepPrimAPI_MakeBox`    | ✅  | ✅      |
| Cylinder  |      ✅      | ✅ `BRepPrimAPI_MakeCylinder` | ✅  | ✅      |
| Sphere    |      ✅      |              ❌               | ✅  | 🟡     |
| Cone      |      ✅      |              ❌               | ✅  | 🟡     |
| Torus     |      ✅      |              ❌               | ✅  | 🟡     |
| Wedge     |      ✅      |              ❌               | ✅  | 🟡     |

> Sphere/Cone/Torus/Wedge have param types and toolbar buttons; adding one creates a feature but it produces no geometry
> because `handleRebuild` has no case for it. There is a `CreatePrimitiveRequest` worker type that is **not handled** in
> the worker switch.

### 2.3 Boolean operations

| Op        | Engine (`performBooleanOperation`) | Used in rebuild  | Standalone UI | Status |
|-----------|:----------------------------------:|:----------------:|:-------------:|--------|
| Union     |                 ✅                  | ✅ (boss combine) |   🟡 button   | 🟡     |
| Subtract  |                 ✅                  | ✅ (cut combine)  |       —       | 🟡     |
| Intersect |                 ✅                  |        ❌         |   🟡 button   | 🟡     |

> Engine supports all three; rebuild only uses union/subtract implicitly via boss/cut. A `BooleanOperationRequest` type
> exists but is **not handled** in the worker. No multi-body selection model yet.

### 2.4 Modifications

| Op      | Params type | Engine | UI | Status | OCC API to use                  |
|---------|:-----------:|:------:|:--:|--------|---------------------------------|
| Fillet  |      ✅      |   ❌    | ✅  | ❌      | `BRepFilletAPI_MakeFillet`      |
| Chamfer |      ✅      |   ❌    | ✅  | ❌      | `BRepFilletAPI_MakeChamfer`     |
| Shell   |      ✅      |   ❌    | ✅  | ❌      | `BRepOffsetAPI_MakeThickSolid`  |
| Offset  |      ✅      |   ❌    | ✅  | ❌      | `BRepOffsetAPI_MakeOffsetShape` |

### 2.5 Transforms

| Op     | Params type | Engine | UI | Status | OCC API                  |
|--------|:-----------:|:------:|:--:|--------|--------------------------|
| Move   |      ✅      |   ❌    | ✅  | ❌      | `gp_Trsf.SetTranslation` |
| Rotate |      ✅      |   ❌    | ✅  | ❌      | `gp_Trsf.SetRotation`    |
| Mirror |      ✅      |   ❌    | ✅  | ❌      | `gp_Trsf.SetMirror`      |
| Scale  |      ✅      |   ❌    | ✅  | ❌      | `gp_Trsf.SetScale`       |

### 2.6 Advanced modeling

| Op    | Status          | OCC API                                    |
|-------|-----------------|--------------------------------------------|
| Sweep | ❌ (UI disabled) | `BRepOffsetAPI_MakePipe` / `MakePipeShell` |
| Loft  | ❌ (UI disabled) | `BRepOffsetAPI_ThruSections`               |

---

## 3. Import / Export

| Format     | Direction       | Status          | OCC API                         |
|------------|-----------------|-----------------|---------------------------------|
| STEP       | Import / Export | ❌ (UI disabled) | `STEPControl_Reader` / `Writer` |
| IGES       | Import / Export | ❌ (UI disabled) | `IGESControl_Reader` / `Writer` |
| STL        | Export          | ❌ (UI disabled) | `StlAPI_Writer`                 |
| glTF / GLB | Export          | ❌ (UI disabled) | `RWGltf_CafWriter`              |
| OBJ        | Import          | ❌               | `RWObj_CafReader`               |

---

## 4. Measurement & Analysis

| Tool                           | Status       | OCC API                            |
|--------------------------------|--------------|------------------------------------|
| Measure (distance/length)      | 🟡 type only | `BRepExtrema_DistShapeShape`       |
| Volume / Area / Center of mass | ❌            | `BRepGProp` / `GProp_GProps`       |
| Bounding box                   | ❌            | `Bnd_Box` / `BRepBndLib`           |
| Shape validity check           | ❌            | `BRepCheck_Analyzer`               |
| Shape healing                  | ❌            | `ShapeFix_Shape` / `Wire` / `Face` |

---

## 5. Application Features

| Feature                          | Status | Notes                                                     |
|----------------------------------|--------|-----------------------------------------------------------|
| Feature tree (hierarchy)         | ✅      | `FeatureTree.tsx`                                         |
| Reorder features                 | ✅      | `reorderFeature`                                          |
| Suppress / unsuppress            | ✅      | `toggleFeatureSuppression`                                |
| Visibility toggle                | ✅      | per-feature `isVisible`                                   |
| Edit feature parameters          | ✅      | `OperationPanel`                                          |
| Parametric rebuild               | 🟡     | only wired feature types replay                           |
| localStorage persistence         | ✅      | key `occad-project`                                       |
| Face → sketch workflow           | ✅      | `getFaceGeometry`                                         |
| **Undo / Redo**                  | ❌      | **No history stack** — highest-impact gap                 |
| Multi-body / part management     | ❌      | single implicit `currentBody`                             |
| Reference geometry (planes/axes) | 🟡     | types + reference planes render; no custom-plane creation |
| Measurement readout panel        | ❌      | —                                                         |

---

## Priority Roadmap (suggested order)

1. **Undo / Redo** — history stack in `useCADState` (snapshot or command pattern). Broadly useful, no OCC work.
2. **Remaining primitives** — Sphere, Cone, Torus, Wedge: add cases to `handleRebuild` + `CreatePrimitive` handler.
   Small, self-contained.
3. **Constraint editing UI + solver wiring** — build the typed→planegcs converter (or adopt planegcs format), add real
   solver-behavior tests, then surface it: select entities → apply constraint; constraint list panel.
4. **Transforms** — Move/Rotate/Mirror/Scale via `gp_Trsf`. Engine + rebuild cases.
5. **Modifications** — Fillet/Chamfer/Shell/Offset (needs edge/face selection plumbing).
6. **Import/Export** — STEP/STL/glTF first (most requested interchange).
7. **Advanced modeling** — Sweep/Loft.
8. **Analysis** — measure, mass properties, bounding box.

---

_Last updated: 2026-06-23. Keep statuses honest — only mark ✅ when types + engine + rebuild + UI are all wired._
