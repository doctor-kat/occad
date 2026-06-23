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
| **Sketch constraints**     | ✅      | 10 constraints end-to-end (factory+solver tests+UI+e2e); create/list/delete; point-level selection | — | Midpoint, Symmetric (need composition) |
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

**Overall:** Sketch + constraints + extrude/revolve + boolean pipeline is solid. The biggest gaps are **undo/redo**,
the **remaining primitives**, and the **modify/transform/IO** families (UI buttons exist but do nothing on rebuild).

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

- ✅ **Constraint factory** (`engine/sketch/constraintFactory.ts`): `createConstraint(id, input)` builds planegcs
  objects from semantic requests; replaces the orphaned typed interfaces as the canonical creation path.
- ✅ **Real-solver tests** (`constraintFactory.test.ts`): planegcs runs in vitest and the suite proves each constraint
  actually drives geometry (not mocked). See `TODO.md` for the full plan/phases.

"Solve test" = real planegcs solve asserting geometry moves. "Factory" = `createConstraint` support.

| Constraint    | Factory | Solve test (real) | Add/edit UI | e2e | Status |
|---------------|:-------:|:-----------------:|:-----------:|:---:|--------|
| Horizontal    |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Vertical      |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Parallel      |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Perpendicular |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Equal         |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Angle         |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Coincident    |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Distance      |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Radius        |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Tangent       |    ✅    |         ✅          |      ✅      |  ✅  | ✅     |
| Fixed         |   n/a¹  |         —          |      —      |  —  | 🟡     |
| Midpoint      |    ❌    |         ❌          |      ❌      |  ❌  | ❌²     |
| Symmetric     |    ❌    |         ❌          |      ❌      |  ❌  | ❌²     |

¹ Fixed is modeled by setting `primitive.fixed = true`, not as a planegcs constraint object.
² Midpoint & Symmetric have no single planegcs primitive (`symmetric` doesn't exist; `midpoint_on_line_*`
  is line-midpoint-on-line, not point-at-midpoint). They require *composing* multiple constraints — deferred.

**Status:** (see `TODO.md` for the live plan)

1. ✅ **All 10 standard constraints complete end-to-end.** `constraintFactory` (`createConstraint`) is the canonical
   typed→planegcs creation path (replaced the orphaned `types/sketch/constraints/*.ts` interfaces, now deleted).
   `useCADState.addConstraint/removeConstraint` wire it into state. `SketchConstraintToolbar` (compact icon toolbar)
   creates all 10 kinds; `SketchConstraintList` shows + deletes them; `SketchOverlay` supports whole-element AND
   point-level (endpoint) selection. e2e: `constraints-line.spec.ts` (5), `constraints-circle.spec.ts` (radius solve
   10→40), `constraints-advanced.spec.ts` (tangent/angle/coincident/distance + delete) — all green.
2. ✅ **Circle `c_id` + OCC fixed.** `elementsToPrimitives` emits `c_id`; OCC/overlay readers accept `c_id ?? center_id`;
   `translatePrimitivesToOCC` uses the correct OCC overloads (`BRepBuilderAPI_MakeEdge_8` for a full circle, `_9` for an
   arc — the old `_10`/`_11` threw `BindingError`). Circles now build wires + solve end-to-end (radius 10→40 in e2e);
   this also unblocks circle extrude.
   - 2a. Arc/ellipse still emit `center_id` (readers fall back); arcs additionally need `start_id`/`end_id` *point*
     primitives before they can solve — a larger reshape, not yet done.
3. ✅ **Point-level selection** — `SketchOverlay` renders clickable endpoint/center handles in selection mode;
   coincident/distance read the selected point-primitive ids. Selection now persists across incidental remounts
   (only cleared when switching into a drawing tool).
4. ❌ **Midpoint / Symmetric** — no single planegcs primitive; require composing multiple constraints. Deferred.

---

## 2. 3D Features

### 2.1 Sketch-based

| Feature      | Engine | Rebuild | Boolean combine | UI | Status |
|--------------|:------:|:-------:|:---------------:|:--:|--------|
| Extrude Boss |   ✅    |    ✅    |      union      | ✅  | ✅      |
| Extrude Cut  |   ✅    |    ✅    |    subtract     | ✅  | ✅      |
| Revolve Boss |   ✅    |    ✅    |      union      | ✅  | ✅      |
| Revolve Cut  |   ✅    |    ✅    |    subtract     | ✅  | ✅      |

> **Fixed (2026-06-23):** "No closed sketches" when extruding a freshly drawn rectangle. `updateSketchElements`
> correctly set `isClosed`, but the subsequent solver round-trip returned a `solvedSketch` carrying a stale
> `isClosed`, and `updateSketchState` replaced the sketch wholesale — clobbering the flag. `updateSketchState` now
> re-derives `isClosed` from the elements (single source of truth). Regression tests in `useCADState.test.ts`.
>
> **Fixed (2026-06-23):** Flat / zero-depth extrude on the Top or Right plane. The worker hardcoded the extrude
> direction to world **+Z**; a sketch on the Top Plane (XZ, normal +Y) or Right Plane (YZ, normal +X) was therefore
> extruded *within its own plane* → degenerate solid. Extrude now defaults to the face's own normal via
> `resolveExtrudeDirection` / `getPlanarFaceNormal` (`operations.ts`), falling back to +Z only when no normal can be
> derived. Also fixed: creating a sketch-based feature left the app in sketch-edit mode — `handleOperationConfirm`
> now calls `stopSketchEdit()`. **Why this escaped:** `operations.ts` had no unit tests and the worker is mocked in
> unit tests; the only e2e extrude ran on a box's *top face* (world normal +Z, where the hardcoded value coincided),
> and asserted only that the feature node appeared — a flat prism passed. Added: extrude-direction unit tests
> (`operations.test.ts`), workplane-normal tests (`useCADState.test.ts`), and a Top-Plane extrude e2e
> (`primitives.spec.ts`) that asserts sketch-mode exit and that the "No closed sketches" warning never shows.

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
3. **Constraint editing UI** — ✅ done: all 10 constraints (toolbar + list/delete + point-level selection + e2e).
   Remaining only: Midpoint & Symmetric (need multi-constraint composition; no single planegcs primitive).
4. **Transforms** — Move/Rotate/Mirror/Scale via `gp_Trsf`. Engine + rebuild cases.
5. **Modifications** — Fillet/Chamfer/Shell/Offset (needs edge/face selection plumbing).
6. **Import/Export** — STEP/STL/glTF first (most requested interchange).
7. **Advanced modeling** — Sweep/Loft.
8. **Analysis** — measure, mass properties, bounding box.

---

_Last updated: 2026-06-23 — fixed rectangle "no closed sketches" + flat-extrude (Top/Right plane) + sketch-mode-exit bugs. Keep statuses honest — only mark ✅ when types + engine + rebuild + UI are all wired._
