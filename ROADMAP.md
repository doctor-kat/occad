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
| **Modifications**          | ✅      | Fillet, Chamfer, Shell, Offset (engine+rebuild+UI)  | —               | —                                |
| **Transforms**             | ❌      | —                                                   | UI + types only | Move, Rotate, Mirror, Scale      |
| **Advanced modeling**      | ❌      | —                                                   | —               | Sweep, Loft                      |
| **Import / Export**        | ❌      | —                                                   | UI (disabled)   | STEP, IGES, STL, glTF, OBJ       |
| **Measurement / Analysis** | ❌      | —                                                   | Type only       | Measure, volume, area, CoM, bbox |
| **Feature tree**           | ✅      | Tree, reorder (deterministic), suppress, visibility, edit | —         | Wire reorder to a drag handler   |
| **Undo / Redo**            | ✅      | Snapshot history in `useCADState` (records per version change, ignores derived enrichments); Toolbar buttons + Ctrl/⌘+Z·Y wired; undo rebuilds | — | — |
| **Parametric rebuild**     | 🟡     | Sketch→extrude/revolve, box, cylinder, booleans     | —               | All non-wired feature types      |
| **Deterministic topology** | 🟡     | Step 1: deterministic build order + working reorder + loud stale-selection errors. Step 2: fingerprint engine. Step 3a/3b: fingerprint-aware resolution + lazy capture wired into rebuild (fillet/chamfer/shell/offset selections now survive index renumber). Step 3c: OCC-history scaffold (`history.ts`) + sketch external-geom now fingerprint-stable (`findShapeByRef`, vertex fingerprints, lazy `sourceRef` capture). Step 4: snapshot undo/redo | — | Boolean exact-history resolution deferred (no payoff for current selection model) — see "Deterministic topology" section below |

**Overall:** Sketch + constraints + extrude/revolve + boolean + modification pipeline is solid. The biggest gaps are
**undo/redo**, the **remaining primitives**, and the **transform/IO** families (UI buttons exist but do nothing on
rebuild).

---

## 1. Sketch System

> **Fixed (2026-06-24):** picking a sketch tool (Rectangle/Line/etc.) with nothing selected used
> to silently auto-create a sketch on the Front Plane. It now requires a sketch plane/face: if one
> is selected the sketch starts there; otherwise all three reference planes are revealed for picking
> (`awaitingSketchPlane` → `ReferencePlanes` `showAllPlanes`) and a "Select a sketch plane" prompt
> shows. Clicking a plane while awaiting starts the sketch. The operation-selection effect in
> `CADLayout` was split into a panel-open effect and a sketch-entry effect (so selection changes
> no longer reset feature-editing state); plane/face sketch creation is shared via
> `beginFaceSketch`/`createSketchOnPlane`. Covered by `CADLayout.test.tsx` + `ReferencePlanes.test.tsx`.

> **Fixed:** multi-click sketch tools (rectangle/line/polygon/arc) used to drop the second
> click after the first point was placed (the plane's R3F handlers re-bound on state change),
> surfacing downstream as "No closed sketches". `SketchOverlay` now keeps its pointer handlers
> referentially stable (points read from a ref) and marks decorations non-raycastable. Covered
> by `e2e/helpers.ts drawClosedRectangle` + the Top-Plane extrude e2e.

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

| Op      | Params type | Engine | Rebuild | UI | Status | OCC API used                    |
|---------|:-----------:|:------:|:-------:|:--:|--------|---------------------------------|
| Fillet  |      ✅      |   ✅    |    ✅    | ✅  | ✅      | `BRepFilletAPI_MakeFillet`      |
| Chamfer |      ✅      |   ✅    |    ✅    | ✅  | ✅      | `BRepFilletAPI_MakeChamfer`     |
| Shell   |      ✅      |   ✅    |    ✅    | ✅  | ✅      | `BRepOffsetAPI_MakeThickSolid`  |
| Offset  |      ✅      |   ✅    |    ✅    | ✅  | ✅      | `BRepOffsetAPI_MakeOffsetShape` |

> **Added (2026-06-23):** Modification engine (`src/cad/engine/modifications.ts`) + rebuild wiring. Unlike sketch
> features/primitives, modifications transform the **current body in place** (no boolean combine): `handleRebuild`
> now has a branch that feeds `currentBody` through `applyFillet` / `applyChamfer` / `applyShell` / `applyOffset` and
> replaces it with the result (a modification with no body yet is a no-op; a failing one leaves the prior body intact
> via the per-item try/catch). Edge/face selections (`edge-N` / `face-N`, 0-based) are mapped to OCC sub-shapes by
> `resolveSubShapes` (0-based ref → 1-based `FindKey(N+1)`, mirroring `handleGetFaceGeometry`; out-of-range/malformed
> refs are skipped). Fillet/chamfer use constant radius/distance per edge; shell removes the selected faces with
> `MakeThickSolidByJoin`; offset acts on the whole body via `PerformByJoin`.
>
> **Tests (TDD):** `modifications.test.ts` (19 cases) covers ref parsing, sub-shape resolution, parameter
> validation (empty selection, non-positive radius/distance, zero thickness), and that each op drives the expected
> OCC calls — using a mock `oc` (the WASM kernel is not loaded in unit tests, same constraint noted for
> `operations.ts`). Geometric validity is exercised by `e2e/modifications.spec.ts`. ⚠️ The unit suite cannot catch a
> wrong OCC constructor/method name (a runtime-only failure per the CLAUDE.md hook-import gotcha); run the e2e suite
> / load the app to confirm real geometry before relying on this.

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

> **Added (2026-06-24):** `OperationsBar` now supports a **stacked compact-button layout** for selected operations.
> New `CompactOperationButton.tsx` renders an icon + inline (horizontal) label at 116×34 instead of the 72×72
> square `OperationButton`. `OperationsBar` renders a vertical `Stack` of these (`renderStackedColumn`) so two
> compact buttons occupy the height of one square button. Started with the sketch tab: **Line** and **Rectangle**
> (`stackedSketchOps`) now stack in a single column; the remaining sketch ops stay as square buttons. Covered by
> `OperationsBar.test.tsx`. There is also an **icon-only** variant `IconOperationButton.tsx` (34×34, label exposed
> via tooltip + `aria-label`, no visible text) for the densest layouts — `IconOperationButton.test.tsx`.
>
> **Added (2026-06-24):** **Operation groups / split buttons** (`OperationGroupButton.tsx`). A group renders the
> currently-shown option as a normal operation button (usable directly without opening the menu) plus an attached
> caret segment — styled as a button group: an outlined, `overflow:hidden` rounded container with a `Divider`
> between the body and the caret. The body button is rendered with `radius={0}` (new optional `radius` prop on
> `OperationButton`/`CompactOperationButton`/`IconOperationButton`) so it sits flush against the divider while the
> container clips the outer corners back to rounded. Caret placement follows the variant: bottom for the big `full`
> button, right edge for `compact`/`icon`. Picking a dropdown item changes the shown option **and** activates it;
> the caret's `aria-label` (`"<label> options"`) tracks the shown option. First use: the **Line** group
> (`lineGroup` in `OperationData.tsx`) with options Line / Centerline / Midpoint Line — the latter two are
> **disabled** (not implemented; added as `SketchOperation.CENTERLINE` / `MIDPOINT_LINE` and to
> `disabledOperations`). Covered by `OperationGroupButton.test.tsx`.
>
> **Changed (2026-06-23):** `OperationsBar` tabs reorganized by **Area** (matching this doc's Summary table). The
> catch-all **Features** tab was split into **Primitives**, **Modifications** (Extrude/Revolve Cut + Fillet/Chamfer/
> Shell/Offset + Union/Intersect), and **Advanced** (Extrude/Revolve Boss + Sweep/Loft). Tab order is now
> Sketch · Primitives · Modifications · Transform · Advanced · Evaluate · I/O. Default active tab is now
> `PRIMITIVES`. `OperationCategory.FEATURES` is retained (sidebar Feature-Tree tab still uses it) but no longer
> drives an operations-bar tab. Operation groupings in `OperationData.tsx` were untouched — only their tab placement
> changed.
>
> **Added (2026-06-23):** Sketch hover **and selection** from the viewport (outside sketch mode). `SketchWireframes`
> rendered bare `lineSegments` with no pointer handlers (raw line raycasting is too thin to hit). It now places
> invisible cylinder hit-areas along each segment (same pattern as `OCCModel` edge hover). Hover sets
> `hoveredTreeItem`; clicking calls `onSketchClick → selectTreeItem(sketchId)` (plumbed
> CADLayout→CADViewport→OpenCascadeViewport→Scene, mirroring `onPlaneClick`). The wireframe is orange when hovered,
> blue when selected (`selectedTreeItem === sketchId`) — so the viewport *and* the `FeatureTree` row stay in sync
> both directions, matching reference-plane behaviour.
>
> Selection required replacing the `BackgroundPlane` click-catcher (a 10 000² ground plane) with the Canvas-level
> `onPointerMissed` — the catcher sat in front of sketch wireframes along many rays and stole their clicks via
> `stopPropagation`. `onPointerMissed` clears selection only when a click truly hits nothing (skipped in sketch
> mode). `BackgroundPlane.tsx` deleted.
>
> The rectangle draw-*preview* (yellow rubber-band) works since commit `1410072`. A *separate*, real bug —
> the second rectangle click being silently dropped, surfacing as "No closed sketches" on Extrude — was fixed
> later (`fix(sketch): second click dropped …`): the `SketchOverlay` pointer handlers depended on `currentPoints`,
> so placing the first point re-bound the plane's R3F handlers and the plane stopped receiving pointer events.
> Handlers are now referentially stable (points read from a ref) and decorations are non-raycastable.
>
> This `Sketch hover + select (viewport)` feature was committed in `feat(viewport): sketch wireframe hover +
> selection from the canvas` (the doc previously described it before the code landed).

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
| Sketch hover + select (viewport) | ✅      | `SketchWireframes` cylinder hit-areas; tree↔viewport sync |
| **Undo / Redo**                  | ✅      | Snapshot history in `useCADState`; buttons + Ctrl/⌘+Z·Y   |
| Multi-body / part management     | ❌      | single implicit `currentBody`                             |
| Reference geometry (planes/axes) | 🟡     | types + reference planes render (visibility toggle fixed 2026-06-24; dashed midpoint crosshair through origin + viewport hover highlight added 2026-06-24); no custom-plane creation |
| Measurement readout panel        | ❌      | —                                                         |

---

## Priority Roadmap (suggested order)

1. **Undo / Redo** — ✅ done: snapshot history in `useCADState` (records per `version` change,
   ignores derived enrichments); Toolbar buttons + Ctrl/⌘+Z·Y; undo rebuilds.
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

## Deterministic topology & stable selections

The classic CAD **topological-naming problem**: every face/edge selection used to be stored as a
**positional ordinal index** (`face-N` / `edge-N`) into an OpenCascade `TopTools_IndexedMapOfShape`.
Those indices renumber on any topology-changing edit (booleans, upstream edits, reorder, suppress),
so a stored `edge-7` could silently bind to a *different* sub-shape. This was driven to ground in a
multi-step effort (formerly tracked in `DETERMINISTIC.md`, now folded here). **Status: ✅ complete**
for this app's op set; one refinement deliberately deferred (below).

**What shipped**

1. **Deterministic build order.** `src/cad/types/project/buildOrder.ts` — `orderKey = sequence ??
   createdAt`, tie-broken by `id` (`compareBuildOrder`), shared by the worker rebuild
   (`operations.ts handleRebuild`) **and** the feature tree (`useCADState.ts featureTree`) so they
   never disagree or depend on `Array.sort` stability. `reorderFeature` assigns an explicit
   `sequence` slotted between neighbours (kept strictly after a consumed sketch).
2. **Geometric fingerprints.** `src/cad/engine/fingerprint.ts` (pure, `ctx.oc`-injected → unit-tested
   without WASM) anchors a sub-shape to its *geometry* — surface/curve type + GProp measure +
   centroid + sorted OBB half-sizes; vertices fingerprint from their `BRep_Tool.Pnt` point.
   `matchFingerprint` refuses to choose between near-identical candidates (confident/ambiguous).
3. **Stable refs + lazy capture.** Selections persist as a `GeometryRef = string | StableRef`
   (`Fingerprint.ts`); a bare `edge-N` string still works (no migration). `resolveSubShapes`
   (`modifications.ts`) re-finds fingerprinted refs by geometry, falling back to the ordinal index,
   and reports unresolved refs **loudly** (`unresolved`) instead of silently filleting the wrong
   edge. Fingerprints are captured lazily in the worker against the body where indices are still
   valid — for modification selections (`enrichRefs`, fillet/chamfer/shell/offset) and for sketch
   **external geometry** (`enrichSketchExternalRefs` + `findShapeByRef`, vertex/edge/face). Captures
   ship in `rebuildComplete.{refEnrichments,sketchRefEnrichments}` and persist **without bumping
   `version`** (derived data → no rebuild loop), converging after one rebuild.
4. **Snapshot undo/redo.** `useCADState` records one `CADProject` snapshot per `version` change
   (so derived enrichments are invisible to undo); `undo`/`redo` replay across two stacks. The
   `CADLayout` rebuild trigger compares `version !== lastRebuilt` (not `>`) so an undo — which
   restores a *lower* version — still rebuilds. Toolbar buttons + Ctrl/⌘+Z·Y wired.

**Deferred (not pursued): boolean exact-history resolution.** `src/cad/engine/history.ts` is a pure
scaffold over OCC `BRepTools_History` / maker `Modified`/`Generated`/`IsDeleted` (with
`carryThroughHistory`, `Merge_1`), but it is **not wired into resolution**: for the current selection
model a modification's edges/faces are selected against the *same* body the modification then acts on
(selection-origin == use-point), so the fingerprint already re-anchors them across renumbers
(modifications e2e 6/6). Exact history only pays off once selections carry a *creation-time* stable id
to propagate across intervening booleans — the scaffold is ready for that day. Deferred rather than
shipped as speculative dead code.

**Gotchas for whoever extends this**
- `useOpenCascade` is instantiated **once** in `CADLayout` — a second call spawns a separate worker
  with isolated shape storage.
- Unit tests mock OCC (`mockCtx`); real geometric validity is **e2e only** — keep fingerprint/history
  logic pure and `oc`-injected so it stays mockable.
- The worker's **single interleaved** sketch+feature pass is intentional: external-geometry sketches
  re-project against the `currentBody` at their point in the order. Do **not** split into "all
  sketches then all features" — it breaks projection.

**Key files:** `buildOrder.ts` · `fingerprint.ts` · `modifications.ts` (`resolveSubShapes`/`enrichRefs`)
· `sketch/externalGeometry.ts` (`findShapeByRef`/`enrichSketchExternalRefs`) · `history.ts` (scaffold)
· `operations.ts` (`handleRebuild`) · `useCADState.ts` (tree, reorder, undo/redo, enrichment appliers).
Each has a co-located `*.test.ts`.

---

_Last updated: 2026-06-24 — completed the deterministic-topology effort (fingerprint-stable sketch
external geometry incl. vertex fingerprints + lazy `sourceRef` capture; OCC-history scaffold
`history.ts`) and snapshot undo/redo (Toolbar + Ctrl/⌘+Z·Y), then folded the former `DETERMINISTIC.md`
living doc into the "Deterministic topology & stable selections" section above. Boolean exact-history
resolution deferred (no payoff for the current selection model). Earlier (2026-06-23): implemented the
Modifications family (fillet/chamfer/shell/offset) end-to-end and reorganized the operations bar into
area-based tabs. Keep statuses honest — only mark ✅ when types + engine + rebuild + UI are all wired._
