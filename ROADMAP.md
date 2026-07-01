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

| Area                         | Status | Done                                                      | Partial         | Todo                                                |
|------------------------------|--------|-----------------------------------------------------------|-----------------|-----------------------------------------------------|
| **Sketch primitives**        | ✅     | Line, Rectangle, Circle, Arc, Ellipse, Polygon (+ variants) | —               | — (Bezier won't implement — see §1.1.1)             |
| **Sketch constraints**       | ✅     | 10 constraints end-to-end (UI+solver+e2e)                 | —               | Midpoint, Symmetric                                 |
| **Sketch-based features**    | ✅     | Extrude Boss/Cut, Revolve Boss/Cut                        | —               | —                                                   |
| **Primitives**               | 🟡     | Box, Cylinder                                             | —               | Sphere, Cone, Torus, Wedge                          |
| **Boolean ops**              | 🟡     | Union, Subtract, Intersect (engine)                       | —               | UI for standalone booleans                          |
| **Modifications**            | ✅     | Fillet, Chamfer, Shell, Offset                            | —               | —                                                   |
| **Transforms**               | ❌     | —                                                         | UI + types only | Move, Rotate, Mirror, Scale                         |
| **Advanced modeling**        | ❌     | —                                                         | —               | Sweep, Loft                                         |
| **Import / Export**          | ❌     | —                                                         | UI (disabled)   | STEP, IGES, STL, glTF, OBJ                          |
| **Measurement / Analysis**   | ❌     | —                                                         | Type only       | Measure, volume, area, CoM, bbox                    |
| **Feature tree**             | ✅     | Tree, reorder, suppress, visibility, edit                 | —               | Wire reorder to drag handler                        |
| **Undo / Redo**              | ✅     | Snapshot history + Ctrl/⌘+Z·Y; undo rebuilds              | —               | —                                                   |
| **Mouse model (SolidWorks)** | 🟡     | Camera on MMB (orbit, Ctrl+MMB pan, wheel zoom) — §6a     | —               | RMB menu; confirm pan gesture                       |
| **Selection / picking**      | ✅     | Single-pick model entities; **sketch box/crossing + multi-select** — §6b | —          | Model box/crossing intentionally out of scope — §6b |
| **Parametric rebuild**       | 🟡     | Sketch→extrude/revolve, box, cylinder, booleans           | —               | All non-wired feature types                         |
| **Deterministic topology**   | 🟡     | Fingerprint-stable selections survive rebuild (steps 1–4) | —               | Boolean exact-history (deferred) — see below        |

**Overall:** Sketch + constraints + extrude/revolve + boolean + modification pipeline is solid. The biggest gaps are
**undo/redo**, the **remaining primitives**, and the **transform/IO** families (UI buttons exist but do nothing on
rebuild).

---

## 1. Sketch System

> **Esc exits sketch mode (2026-06-30):** in the sketch overlay, `Esc` now aborts the in-progress element
> if one is being drawn (unchanged), otherwise **exits sketch editing** (wired to `onCancelSketch` via a new
> `onExitSketch` prop threaded `OpenCascadeViewport` → `Scene` → `SketchOverlay`). Previously `Esc` with no
> draw in progress only cleared the selection.

> **Fixed (2026-06-24):** picking a sketch tool (Rectangle/Line/etc.) with nothing selected used
> to silently auto-create a sketch on the Front Plane. It now requires a sketch plane/face: if one
> is selected the sketch starts there; otherwise all three reference planes are revealed for picking
> (`awaitingSketchPlane` → `ReferencePlanes` `showAllPlanes`) and a "Select a sketch plane" prompt
> shows. Clicking a plane while awaiting starts the sketch. The operation-selection effect in
> `CADLayout` was split into a panel-open effect and a sketch-entry effect (so selection changes
> no longer reset feature-editing state); plane/face sketch creation is shared via
> `beginFaceSketch`/`createSketchOnPlane`. Covered by `CADLayout.test.tsx` + `ReferencePlanes.test.tsx`.
>
> **Refined (2026-06-24):** the "Select a sketch plane" prompt was a transient toast that
> auto-dismissed, leaving the planes revealed with no guidance. It is now a **persistent**
> in-viewport banner (top-center, in `OpenCascadeViewport`) shown while `awaitingSketchPlane` is
> true — no sketch is created yet. It stays until the user clicks a plane/face (which starts the
> sketch) or cancels via the banner's Cancel button or `Esc` (`handleCancelSketchPlane` →
> `selectOperation(null)`, threaded `CADLayout` → `CADViewport` → `OpenCascadeViewport`). Covered
> by `CADLayout.test.tsx` (awaiting-mode cancel + Escape).

> **Fixed:** multi-click sketch tools (rectangle/line/polygon/arc) used to drop the second
> click after the first point was placed (the plane's R3F handlers re-bound on state change),
> surfacing downstream as "No closed sketches". `SketchOverlay` now keeps its pointer handlers
> referentially stable (points read from a ref) and marks decorations non-raycastable. Covered
> by `e2e/helpers.ts drawClosedRectangle` + the Top-Plane extrude e2e.
>
> **Fixed (2026-06-26):** sketch entities **and** the draw preview (e.g. the corner-rectangle
> rubber-band) were **invisible on some GPUs** — users saw the green anchor dot, grid and origin
> crosshair, but no line/circle/rectangle geometry or preview. Root cause: sketch geometry was
> drawn with drei's `<Line>` (a `Line2`/`LineMaterial` *fat* line), whose shader renders nothing
> on certain ANGLE/driver backends, while the native grid/crosshair (`LineBasicMaterial`) drew
> fine. Both in-sketch renderers (`SketchElementRenderer3D` used by `SketchOverlay`, and
> `SketchRenderer` used by `OpenCascadeViewport`) now render via a shared **native-line** helper
> `NativePolyline` (`<line>` + `LineBasicMaterial`, dashed via a manual `lineDistance` attribute
> for construction/external geometry) — the same reliable tech as the grid. Trade-off: native GL
> lines are width-1 (the GPU ignores `linewidth > 1` on most platforms), so strokes are thinner;
> hover/selection are conveyed by **color**, not width. **Why it wasn't caught:** the only
> sketch-overlay e2e checked for THREE-namespace console errors, and the jsdom `<Canvas>` smoke
> test never builds a scene graph (no WebGL), so an invisible-but-present fat line passed every
> check. New regression guard `SketchElementRenderer3D.test.tsx` inspects the real THREE scene
> graph via `@react-three/test-renderer` (no GPU) and fails if the renderer regresses to a fat
> `Line2`. NB: click-move-click *was* the intended/only draw model (no drag-to-draw); the preview
> logic itself was always correct — it was purely a rendering-visibility bug.

### 1.1 Sketch primitives

| Primitive | Type         | Builder (`sketchBuilders.ts`) | UI         | Status |
|-----------|--------------|-------------------------------|------------|--------|
| Point             | ✅            | ✅ `point`                     | ✅          | ✅      |
| Line              | ✅            | ✅ `line`                      | ✅          | ✅      |
| Corner Rectangle  | ✅            | ✅ (decomposed to lines)       | ✅          | ✅      |
| Circle            | ✅            | ✅ `circle`                    | ✅          | ✅      |
| Perimeter Circle  | ✅ (→ Circle) | ✅ `circleFromThreePoints`     | ✅          | ✅      |
| Polygon           | ✅            | ✅ (decomposed to lines)       | ✅          | ✅      |
| 3 Point Arc       | ✅            | ✅ `arc`                       | ✅          | ✅      |
| Centerpoint Arc   | ✅            | ✅ `centerpointArc` → `arc`    | ✅          | ✅      |
| Tangent Arc       | ✅            | ✅ `tangentArc` → `arc`        | ✅          | ✅      |
| Ellipse           | ✅            | ✅ `ellipse`                   | ✅          | ✅      |

> **Point tool wired (2026-06-30):** the standalone Point primitive is now drawable end-to-end. Added
> `SketchOperation.POINT` + a **Point** sketch-toolbar button; `mapElementsToPrimitives` maps a `POINT`
> element to a single point primitive keyed by its own id (no `_p1` suffix) so constraints can reference
> it directly; `SketchElementRenderer3D` draws it as a small filled dot; `SketchOverlay` places a point
> on a single click and includes points in hover/selection + snap candidates. Test:
> `elementsToPrimitives.test.ts` (point mapping).

> **Center rectangle guides (2026-06-30):** drawing a Center Rectangle now also emits its **center point**
> and the two **construction diagonals** (opposite corners, crossing at the center), mirroring SolidWorks.
> Pure geometry in `sketchShapeBuilders.centerRectangleGuides`; the overlay mints a `POINT` + two
> `construction` lines alongside the rectangle. Test: `sketchShapeBuilders.test.ts`.

> **Sketch origin point (2026-06-30):** every sketch now carries a *fixed* origin point primitive at the
> workplane (0,0), mirroring the world Origin reference geometry, so drawn geometry can be constrained to
> it. `originPoint.ts` (`ORIGIN_POINT_ID`/`makeOriginPrimitive`/`withOriginPrimitive`) is the canonical
> source; `CADLayout.handleUpdateSketch` prepends it to the solver primitives (de-duped, so it never
> drifts). The overlay renders it as a selectable dot (id `origin`) that can be picked for a constraint.
> Test: `originPoint.test.ts`.

> **Snap-to-origin + coincident (2026-06-30):** while placing a point (line/rectangle corner/point tool),
> the overlay now snaps to the origin (0,0) whenever the cursor is within the snap distance, so geometry
> lands exactly on it (shown by the green snap ring). `originPoint.inferOriginCoincidence(elements)` then
> emits a `p2p_coincident` (tagged `auto`) binding every endpoint/corner/center at (0,0) to the fixed
> origin point; `handleUpdateSketch` merges it with the rectangle H/V auto-relations, regenerated
> idempotently each edit. Tests: `originPoint.test.ts` (coincidence inference incl. construction-line skip).

> **Coincident preview badge (2026-06-30):** while drawing and snapped to the origin, the overlay shows
> the coincident constraint icon (the `Dot` glyph, matching the constraint-badge icon set) that *will* be
> added, drawn as a DOM badge with the orange hover/highlight accent (`#f97316`) as its background so it
> reads as a pending relation. Driven by an `originSnap` flag set in the overlay's snap logic; cleared on
> pointer-leave / non-origin snaps (`data-testid="origin-coincident-preview"`).

> **Circle/arc variants finished (2026-06-27, TDD):** Perimeter (3-point) Circle, Centerpoint Arc and
> Tangent Arc are wired end-to-end. Pure geometry in `src/cad/engine/sketch/arcGeometry.ts`
> (`circleFromThreePoints`/`arcFromThreePoints`/`centerpointArc`/`tangentArc`, 14 unit tests first):
> Perimeter Circle emits a `SketchCircle`; the arcs emit center-based `SketchArc`s (CCW-normalized
> angles, rendered by sampling the sweep). `sketchBuilders` pins the arc's `gp_Ax2` X to the workplane
> X so `MakeEdge_9`'s angles are in the sketch frame. e2e: `e2e/sketch-primitives.spec.ts`. (Arc
> *solid* validity is e2e-only — a lone arc isn't a closed profile.)

**Sketch toolbar groups (UI-only, 2026-06-24):** in the sketch tab every tool except the big **Sketch** button is
rendered small (compact), flowing into **columns of 2, left to right** (CSS grid, `renderSketchTools`). Tools with
variants are compact split-button groups (`OperationGroupButton`) whose dropdowns offer the variants. The original
Rectangle op is relabelled **Corner Rectangle**.

| Group     | Options (✅ = implemented, ❌ = disabled placeholder)                                                        |
|-----------|-------------------------------------------------------------------------------------------------------------|
| Line      | Line ✅ · Centerline ✅ · Midpoint Line ✅                                                                     |
| Rectangle | Corner Rectangle ✅ · Center Rectangle ✅ · 3 Point Corner Rectangle ✅ · 3 Point Center Rectangle ✅ · Parallelogram ✅ |
| Circle    | Circle ✅ · Perimeter Circle ✅ (3-point)                                                                     |
| Arc       | Centerpoint Arc ✅ · Tangent Arc ✅ · 3 Point Arc ✅ (default)                                                 |

**Line & rectangle variants (2026-06-25):** all line/rectangle dropdown variants are now drawable. Pure geometry
lives in `src/cad/engine/sketch/sketchShapeBuilders.ts` (unit-tested); `SketchOverlay` collects the clicks and
previews. **Centerline** is a `SketchLine` with `construction: true` — rendered dashed and skipped by
`mapElementsToPrimitives`, so it stays reference-only and never reaches the OCC profile wire. **Midpoint Line** /
**Center Rectangle** reuse the line/rectangle element types (first click = midpoint/center). The rotated/skewed
variants (**3 Point Corner/Center Rectangle**, **Parallelogram**) can't be an axis-aligned `SketchRectangle`, so
they're emitted as 4-point **polygons**.

Polygon, Ellipse, Bezier are plain compact buttons (no variants). `OperationGroupButton` still supports
`full` (big, caret-on-bottom) and `icon` variants for other toolbars.

### 1.1.1 Removed / won't implement

- **Spline** — removed (2026-06-27). The tool was half-implemented (no OCC translation case, no overlay
  drawing), so `SketchSpline`, the `SPLINE` enum members, the toolbar button and the
  `SKETCH_TOOL_OPERATIONS` entry were deleted. (The OCC B-spline *surface/curve* names in
  `fingerprint.ts` are unrelated and untouched.)
- **Bezier** — 🚫 won't implement. The `SketchBezier` type + toolbar button still exist but there is no
  builder; it remains a known dead button.

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
5. 🟡 **Auto-constraints on draw (SolidWorks "sketch relations").** **Rectangle done (2026-06-27):**
   `inferAutoConstraints(elements)` (`engine/sketch/autoConstraints.ts`) emits 2 Horizontal (top/bottom) + 2 Vertical
   (sides) for every `RECTANGLE` (covers corner **and** center rectangle); corners are coincident by construction
   (shared point ids) so none are emitted. Regenerated every edit in `CADLayout.handleUpdateSketch` with deterministic
   `${id}_auto_*` ids (idempotent) and tagged `auto: true`, merged with the user's manual constraints, then round-tripped
   through the solver onto the sketch. Tests: `autoConstraints.test.ts` (4, incl. real-solver skew→axis-aligned) +
   `e2e/auto-constraints.spec.ts`. **Deferred:** line (coincident-on-snap, near-axis H/V), 3-pt rectangle/parallelogram
   (perpendicular/parallel), and a distinct list badge for auto vs manual. See `TODO.md` Phase 5.
6. ✅ **Constraint badges in the viewport (2026-06-28).** Each constraint shows as a tiny square just above the
   midpoint of its entity; clicking a badge selects (toggles) that constraint. Pure `constraintAnchors.ts` maps a
   planegcs constraint's primitive ids back to a point on the source `SketchElement` (inverse of
   `mapElementsToPrimitives`), averages multi-entity anchors, and stacks badges sharing an anchor. Selection lives in
   `viewportStore.selectedConstraintId`, wired two-way with `SketchConstraintList` (badge ↔ row highlight). Badges
   render in selection mode only (so they never intercept drawing clicks). Tests: `constraintAnchors.test.ts` (12) +
   `SketchConstraintList.test.tsx` (4).

---

## 2. 3D Features

> **Fixed (2026-06-30) — multiple profiles lost constraints.** Drawing a second (disjoint) profile in a
> sketch — e.g. a second rectangle — left it with **no constraints**. `handleBuildSketch` solved the sketch
> (producing the constraints) and *then* called `buildSketchWire`, which combined **all** edges into one
> `BRepBuilderAPI_MakeWire`; two disconnected loops made it throw, aborting before `solvedSketch` (with the
> new constraints) was posted back — so the UI kept only the first profile's constraints. `buildSketchWire`
> now groups edges into connected components (union-find on line endpoint point-ids; each circle/arc/ellipse
> is its own component) and builds **one wire per profile**, returning a `TopoDS_Compound` of wires for
> multi-profile sketches. New `buildProfileFace` turns a wire (or compound of wires) into a face (or compound
> of faces); `ensureFace` passes a compound through so multi-profile extrude prisms each face. Geometry
> building in `handleBuildSketch`/rebuild is now wrapped so a failed profile can't block the constraint
> round-trip (`sketchBuilt.geometry`/`meshData` are optional). Test: `sketchBuilders.test.ts` (per-component
> wires → compound).

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

> **Fixed (2026-06-26):** Sketcher hotkeys panel (`SketchHotkeys.tsx`) appeared in the middle of the viewport
> after maximizing the window. The panel uses drei's `<Html>`, which positions its wrapper at the projected
> 3D point and applies a CSS `transform` to it; a transformed ancestor becomes the containing block for
> `position: fixed` descendants, so the inner box's `bottom/right` resolved against that moving wrapper (the
> sketch-plane origin's projection) instead of the viewport. Now overrides `calculatePosition` to return the
> canvas bottom-right corner and anchors the box there via `translate(-100%, -100%)`, so it stays pinned
> bottom-right regardless of camera/window size.
>
> **Added (2026-06-24):** `OperationsBar` now supports a **stacked compact-button layout** for selected operations.
> New `CompactOperationButton.tsx` renders an icon + inline (horizontal) label at 116×34 instead of the 72×72
> square `OperationButton`. `OperationsBar` renders a vertical `Stack` of these (`renderStackedColumn`) so two
> compact buttons occupy the height of one square button. Started with the sketch tab: **Line** and **Rectangle**
> (`stackedSketchOps`) now stack in a single column; the remaining sketch ops stay as square buttons. Covered by
> `OperationsBar.test.tsx`. There is also an **icon-only** variant `IconOperationButton.tsx` (34×34, label exposed
> via tooltip + `aria-label`, no visible text) for the densest layouts — `IconOperationButton.test.tsx`.
>
> **Fixed (2026-06-26):** `OperationDivider` vertical dividers in the operations bar were top-aligned (Mantine's
> vertical `Divider` ignores the parent flex `align="center"`), leaving a 16px gap below and none above. Added
> `alignSelf: 'center'` so they sit centered (8px above/below) within the 72px button row.
>
> **Added (2026-06-24):** **Operation groups / split buttons** (`OperationGroupButton.tsx`). A group renders the
> currently-shown option as a normal operation button (usable directly without opening the menu) plus an attached
> caret segment — styled as a button group: an outlined, `overflow:hidden` rounded container with a `Divider`
> between the body and the caret. The body button is rendered with `radius={0}` (new optional `radius` prop on
> `OperationButton`/`CompactOperationButton`/`IconOperationButton`) so it sits flush against the divider while the
> container clips the outer corners back to rounded. Caret placement follows the variant: bottom for the big `full`
> button, right edge for `compact`/`icon`. Picking a dropdown item changes the shown option **and** activates it;
> the caret's `aria-label` (`"<label> options"`) tracks the shown option. First use: the **Line** group
> (`lineGroup` in `OperationData.tsx`) with options Line / Centerline / Midpoint Line — all implemented as of
> 2026-06-25 (see "Line & rectangle variants" above); `SketchOperation.CENTERLINE` / `MIDPOINT_LINE` removed from
> `disabledOperations`. Covered by `OperationGroupButton.test.tsx`.
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
| Sketch entity list (sidebar)     | ✅      | `SketchEntitiesPanel` in the Entities tab while sketching — see §7 |
| Sketch constraint list (sidebar) | 🟡     | `SketchConstraintList` exists; not yet in the left sidebar — see §7 |
| History rollback bar (rewind/FF) | ❌      | SolidWorks-style rollback to build only up to a marker — see §8 |
| Multi-body / part management     | ❌      | single implicit `currentBody`                             |
| Reference geometry (planes/axes) | 🟡     | types + reference planes render (visibility toggle fixed 2026-06-24; dashed midpoint crosshair through origin + viewport hover highlight added 2026-06-24); no custom-plane creation |
| Measurement readout panel        | ❌      | —                                                         |
| Sketch view auto-orient          | ✅      | entering a sketch swings the camera "normal to" the sketch plane (`SketchCameraOrient` in Scene, math in `sketchViewpoint.ts`); preserves the current zoom distance and stays on the camera's current side (no back-flip); reorients once per sketch id |

---

## 6a. SolidWorks-style mouse model — 🟡 partial

Goal: make the viewport **mouse model** behave exactly like SolidWorks — camera off the left button, left button is
selection only, right button is free for a context menu.

### Target behavior

| Input                                   | SolidWorks behavior                                        | Status |
|-----------------------------------------|-----------------------------------------------------------|--------|
| **Left click**                          | Selection only — never moves the camera                   | ✅ done (LMB no longer orbits) |
| **Middle click / drag**                 | Camera — rotate (orbit); pan with a modifier; wheel zooms | ✅ done (MMB rotate, Ctrl+MMB pan, wheel zoom) |
| **Right click**                         | Context menu (no camera pan)                              | 🟡 RMB no longer pans; menu still TODO (see §6b Remaining) |

### Done — camera remapped off the left button (`Scene.tsx`)

`OrbitControls` now takes `mouseButtons={CAMERA_MOUSE_BUTTONS}` (`{ LEFT: null, MIDDLE: THREE.MOUSE.ROTATE,
RIGHT: null }`, in `cameraMouseButtons.ts`): the left button no longer orbits (freed for selection) and the right
button no longer pans (freed for the future context menu). Wheel zoom is unchanged. SolidWorks pans with **Ctrl+MMB**
and rotates with plain MMB; since OrbitControls maps one action per button, a `keydown`/`keyup` effect in `Scene`
swaps `controls.mouseButtons.MIDDLE` between `ROTATE`/`PAN` via the pure `middleButtonAction(ctrlKey)` helper. Unit
tests cover the button map and the Ctrl swap (`cameraMouseButtons.test.ts`).

- **Sketch mode:** `SketchOverlay` already owns the left button for drawing (rubber-band preview); disabling the
  left-button orbit only helps it. Camera stays on MMB in sketch mode too.

### Remaining

- **RMB context menu** — see §6b Remaining (the binding is freed here; the menu UI is still to build).
- **Pan gesture** — currently Ctrl+MMB; confirm this is the SolidWorks-faithful gesture we want vs. drei's default
  (see open questions in §6b). Verify touch/trackpad still zoom (`enableZoom`).

---

## 6b. Box/crossing select — ✅ sketch done; model ❌ won't do

Scope: SolidWorks window/crossing box select for **sketch entities** only. Box/crossing for **model**
faces/edges/vertices is **explicitly out of scope** (decided 2026-06-28) — model selection stays single-pick.

> **Done (2026-06-27) — sketch-mode box/crossing select.** In sketch **selection mode** (no draw tool active) the
> left button drives a rubber-band: drag right → **window** (only fully-enclosed entities, solid cyan box), drag left →
> **crossing** (anything touched, dashed green box); Ctrl/Shift merges/toggles into `selectedSketchElementIds`.
> Hit-testing is the pure `selectElementsInBox` (`src/cad/engine/sketch/sketchBoxSelection.ts`): each entity is sampled
> to plane-space points/segments, projected to screen px via the live camera, then tested (window = all points inside;
> crossing = any point inside **or** any edge crosses the rect). Listeners live on `gl.domElement` (raw screen px, no
> plane raycast); a `suppressClickRef` stops the trailing plane `onClick` from also toggling. The rubber-band is a DOM
> overlay in `OpenCascadeViewport` fed by `viewportStore.sketchSelectionBox`. Tests: `sketchBoxSelection.test.ts` (12,
> window/crossing math) + `e2e/sketch-selection.spec.ts` (4, real drags incl. window-vs-crossing discrimination).

> **Won't do (2026-06-28) — model box/crossing select.** Box/crossing for model faces/edges/vertices (and the
> associated multi-select selection-set refactor of `viewportStore`) will **not** be built. Model entities remain
> single-pick. No partial model implementation exists to remove — all box/crossing code is sketch-scoped.

### Sketch box/crossing — target behavior (implemented)

| Input                          | Behavior                                                                        |
|--------------------------------|---------------------------------------------------------------------------------|
| **Left drag → right**          | **Window**: only sketch entities *fully enclosed* by the rectangle (solid cyan) |
| **Left drag → left**           | **Crossing**: any sketch entity *touching* the rectangle (dashed green)         |
| **Ctrl/Shift + the above**     | Merge/toggle the hit set into the current `selectedSketchElementIds`             |

### Model selection (unchanged, single-pick)

R3F `onClick` handlers on each entity (`OCCModel` faces/edges/vertices, `ReferencePlanes`, `SketchWireframes`) write
**single nullable ids** into `viewportStore` (`selectedFaceId` / `selectedEdgeIndex` / `selectedVertexIndex`, plus
`selectedTreeItem` for planes/sketches). Canvas-level `onPointerMissed` clears on an empty click. This stays as-is —
no selection-set refactor, no model box/crossing.

### Remaining (unrelated to selection)

- **RMB context menu** — the right-button binding is freed (§6a) but no menu exists; the browser default still shows.
  Build an `onContextMenu` (preventDefault) → positioned Mantine `Menu` anchored at the cursor (e.g. *Create Sketch on
  Face*, *Hide/Show*, *Zoom to Selection*, *Clear Selection*). Independent of box/crossing.
- **Pan binding** — confirm Ctrl+MMB is the SolidWorks-faithful pan we want vs. drei's default.

---

## 7. Left sidebar: sketch entity & constraint lists — 🟡 entity list done

Goal: while editing a sketch, the **left sidebar** shows two live lists — every **entity** in the
sketch and every **constraint** on it — like the SolidWorks PropertyManager / FeatureManager sketch
view. Status: **entity list ✅** (`SketchEntitiesPanel`), constraint list **🟡** (a `SketchConstraintList`
component exists for the in-sketch toolbar/overlay, see §1.2, but is not yet relocated into the sidebar).

> **Done (2026-06-27) — entity list.** Entering a sketch auto-switches the left sidebar to the **Entities**
> tab, which renders `SketchEntitiesPanel` (the active sketch's elements) instead of the model faces/edges
> panel. One row per `SketchElement` with a per-type icon + label ("Line 1", "Circle 1", …), a construction
> badge, and a delete (X). Rows are two-way wired to the viewport via `viewportStore`: clicking toggles the
> entity in `selectedSketchElementIds` (so the box/crossing selection shows here too); hovering sets the new
> shared `hoveredSketchElementId`, which `SketchOverlay` now reads for its hover highlight (replacing local
> hover state). Tests: `SketchEntitiesPanel.test.tsx` (7). **Still planned:** relocate the constraint list
> into the sidebar and wire its hover to the overlay.

### Target behavior

| Item                | Behavior                                                                                  |
|---------------------|-------------------------------------------------------------------------------------------|
| **Entity list**     | One row per `SketchElement` (Line, Circle, Arc, Rectangle→lines, etc.) with an icon + name + count |
| **Constraint list** | One row per constraint with its kind icon (Horizontal, Coincident, …) + the entities it binds |
| Hover row → viewport | Highlights the corresponding entity/constraint in `SketchOverlay` (two-way, like the feature-tree↔viewport sync) |
| Click row           | Selects that entity/constraint (drives the constraint toolbar's "selected" state)          |
| Delete row          | Removes the entity (`updateSketchElements`) or constraint (`removeConstraint`)             |
| Construction badge  | Construction-geometry entities (e.g. centerlines, `construction: true`) flagged distinctly |

### Implementation notes

- The **left sidebar** today hosts the `FeatureTree` (`OperationCategory.FEATURES` tab). Add a sketch
  context: when `startSketchEdit` is active, the sidebar should switch to (or add) **Sketch Entities**
  + **Sketch Constraints** panels for the active sketch instead of (or above) the global feature tree.
- **Entity list** is new: read `sketch.elements`; map each `SketchElement` to an icon + label. Reuse
  the same hover/select store wiring as `SketchWireframes` (`hoveredTreeItem` / point-level selection
  in `SketchOverlay`).
- **Constraint list** reuses the existing `SketchConstraintList` (currently rendered near the
  constraint toolbar) — relocate/embed it in the sidebar and connect its hover to the overlay.
- Per CLAUDE.md, viewport/sketch changes require tests — cover list rendering, delete, and the
  two-way hover/select sync.

---

## 8. History rollback bar — rewind / fast-forward — ❌ planned

Goal: a **SolidWorks-style rollback bar** in the feature tree. The user drags a horizontal marker up
and down the feature list to **rewind** history (the model rebuilds using only the features *above*
the bar) and **fast-forward** it back. Crucially, new features can be inserted **at the bar's
position** — they're added after the "present" line but before the rolled-back features below it — so
you can edit earlier in the history without deleting later work. Status ❌ (not started).

### Target behavior

| Action                                   | Behavior                                                                       |
|------------------------------------------|--------------------------------------------------------------------------------|
| **Drag bar up (rewind)**                 | Rebuild using only features *above* the bar; features below are skipped (greyed) |
| **Drag bar down (fast-forward)**         | Re-include features back down to the bar position; full FF = bar at the bottom |
| **Insert feature while rolled back**     | New feature is sequenced **at the bar**, pushing rolled-back features after it  |
| **Rolled-back features**                 | Shown greyed/below the bar, **not** deleted; still in the tree and persisted    |
| Edit an upstream feature while rolled back | Rebuild stops at the bar so the edit is cheap and side-effect-scoped          |

### Implementation notes

- This is distinct from **undo/redo** (§ undo/redo / Deterministic topology): rollback is a
  *non-destructive view into the existing feature order*, not a snapshot stack. Both can coexist.
- **State:** add a `rollbackIndex` (or `rollbackBeforeFeatureId`) to `CADProject` (or to UI state if
  it shouldn't persist — decide). It marks the boundary in the **deterministic build order**
  (`buildOrder.ts` `compareBuildOrder`).
- **Rebuild:** `handleRebuild` (`operations.ts`) already iterates features in deterministic order —
  gate the loop to stop at `rollbackIndex` (treat features at/after the bar like `isSuppressed`, but
  via the bar rather than per-feature suppression so the distinction is preserved).
- **Insertion at the bar:** `addFeature` must assign a `sequence` slotted at the bar position (reuse
  the between-neighbours slotting already in `reorderFeature`), then advance the bar past the new
  feature so it becomes part of the "present".
- **UI:** a draggable horizontal divider row in `FeatureTree.tsx`; features below render greyed. Wire
  the drag to update `rollbackIndex` → trigger rebuild (bump `version`).
- Interactions to design: rollback + reorder, rollback + suppress, rollback + undo/redo (does undo
  capture the bar position?), and whether the bar position is persisted to localStorage.
- Per CLAUDE.md, this touches the viewport/rebuild → requires unit tests (build-order gating, insert-
  at-bar sequencing) + an e2e (rewind hides geometry, insert-at-bar lands a feature mid-history).

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

_Last updated: 2026-06-27 — finished the remaining sketch primitives (Perimeter Circle, Centerpoint
Arc, Tangent Arc) TDD with a real e2e; removed Spline (§1.1.1). Earlier (2026-06-26): added planned §7 (left-sidebar sketch entity + constraint lists) and §8
(SolidWorks-style history rollback bar: rewind/fast-forward with insert-at-the-bar), plus matching
rows in the Application Features table. Earlier (2026-06-24): completed the deterministic-topology effort (fingerprint-stable sketch
external geometry incl. vertex fingerprints + lazy `sourceRef` capture; OCC-history scaffold
`history.ts`) and snapshot undo/redo (Toolbar + Ctrl/⌘+Z·Y), then folded the former `DETERMINISTIC.md`
living doc into the "Deterministic topology & stable selections" section above. Boolean exact-history
resolution deferred (no payoff for the current selection model). Earlier (2026-06-23): implemented the
Modifications family (fillet/chamfer/shell/offset) end-to-end and reorganized the operations bar into
area-based tabs. Keep statuses honest — only mark ✅ when types + engine + rebuild + UI are all wired._
