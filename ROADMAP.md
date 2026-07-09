# ROADMAP.md

Status tracker for the goal of a **fully-featured OpenCascade CAD wrapper**: all primitives & features, a
feature tree, undo/redo history, and a constraint-based sketch solver.

Legend: ✅ Done & wired end-to-end · 🟡 Partial · ❌ Not started · 🚫 Won't implement

> **How to read this:** a feature is only ✅ when **types + engine + rebuild + UI** all exist. "Engine" =
> handler in the Web Worker (`src/cad/engine/*`). "Rebuild" = handled in `handleRebuild` for parametric
> history replay. "UI" = button/panel in `OperationsBar`/`OperationPanel`.
>
> This file tracks *status*, not history — the detailed fix-by-fix narrative lives in git. Keep it that
> way: when you finish something, flip its status and delete the stale "todo" text rather than appending a
> dated log.

---

## Status summary

| Area                     | Status | Notes                                                                        |
|--------------------------|:------:|------------------------------------------------------------------------------|
| Sketch primitives        |   ✅   | Line, Rectangle, Circle, Arc, Ellipse, Polygon (+ variants). Bezier 🚫       |
| Sketch constraints       |   ✅   | 11 constraints end-to-end (UI+solver+e2e) + Midpoint. Symmetric 🚫           |
| Sketch-based features     |   ✅   | Extrude Boss/Cut, Revolve Boss/Cut                                           |
| Primitives               |   ✅   | Box, Cylinder, Sphere, Cone, Torus, Wedge                                    |
| Boolean ops              |   ✅   | Union/Subtract/Intersect (engine + standalone Union/Intersect in rebuild)    |
| Modifications            |   ✅   | Fillet, Chamfer, Shell, Offset                                               |
| Transforms               |   ✅   | Move, Rotate, Mirror, Scale                                                  |
| Advanced modeling        |   ✅   | Sweep, Loft                                                                  |
| Import / Export          |   ✅   | STEP/IGES import, STEP/IGES/STL export. glTF export + OBJ import 🚫          |
| Measurement / Analysis   |   ✅   | Volume, Bounding Box, Between distance/angle (Measure tab)                   |
| Feature tree             |   ✅   | Tree, drag-and-drop reorder, suppress, visibility, edit                      |
| Undo / Redo              |   ✅   | Snapshot history + Ctrl/⌘+Z·Y; undo rebuilds                                 |
| History rollback bar     |   ✅   | Drag-to-rewind marker; insert-at-bar; skips rolled-back features on rebuild  |
| Mouse model (SolidWorks) |   ✅   | Camera on MMB (orbit, Ctrl+MMB pan, Shift+MMB zoom); RMB context menu        |
| Selection / picking      |   ✅   | Single-pick model entities; sketch box/crossing + multi-select              |
| Parametric rebuild       |   ✅   | Every body-producing feature type replays; unknown types throw, not skip     |
| Deterministic topology   |   ✅   | Fingerprint-stable selections survive rebuild                                |
| Selector system          |   ✅   | CadQuery-style `>Z`/`<X`/`\|Y` edge/face selectors for fillet/chamfer/shell  |
| Dimensions               |   ✅   | Draggable CAD-style dimension annotations with arrows, gaps, flip            |

**The core feature set is complete.** What remains is a short list of nice-to-haves (below); nothing on it
is blocking.

---

## Open items

Everything below is optional. None is started unless noted.

### Sketch
- 🟡 **Auto-constraints on draw** — rectangles emit H/V relations today. Deferred: line auto-relations
  (coincident-on-snap, near-axis H/V), 3-pt rectangle/parallelogram (perpendicular/parallel), and a
  distinct list badge for auto vs. manual constraints. (`engine/sketch/autoConstraints.ts`)
- 🟡 **Fixed constraint UI** — modeled via `primitive.fixed = true`; no add/edit UI or tests yet.
- ❌ **Primitive groups / folders** — a composite sketch entity that owns its child primitives (e.g. Center
  Rectangle = center point + 2 construction diagonals + rectangle) so they select/delete/move as one unit
  and show as an expandable folder. Least-invasive model: a `groupId` on `SketchElement`.

### Application
- 🟡 **Constraint list in the sidebar** — `SketchConstraintList` exists and is hover-synced with the
  viewport, but still renders near the in-sketch toolbar rather than in the left sidebar next to the
  entity list (§ entity list is done).
- 🟡 **Reference geometry** — XY/XZ/YZ planes render; no custom-plane / axis creation.
- ❌ **Multi-body / part management** — currently a single implicit `currentBody`. Standalone booleans
  no-op without a multi-body selection model.
- ❌ **Measurement readout panel** — the Measure *tab* (volume / bounding box / between) is done; an
  always-visible readout panel is not.

### Infrastructure
- **Custom (trimmed) WASM build** — we load the monolithic `opencascade.full.wasm`. A custom build binding
  only the classes we use → smaller WASM + faster cold start, and would unblock OBJ import (below).
  Files: `opencascadeWorker.ts`, `vite.config.ts`.
- ✅ **String-literal unions → enums** — `TessellationLevel`, `TrackStatus`, `ExportFormat`, `ImportFormat`,
  `SubShapeKind` (merged the `selectors/types.ts` duplicate into `cad/types/geometry/Fingerprint.ts`'s),
  `SketchPrimitiveType`, `OperationButtonVariant`, `CameraViewType`, `Axis` (selectors), `BoxMode`,
  `ConstraintKind` are now proper TS enums (values unchanged, so persisted projects are unaffected). All
  call sites, `Record<>` keys, and tests updated; `tsc --noEmit`/tests clean.

---

## Won't implement (decided)

- **Bezier splines** — type + toolbar button exist but no builder; dead button, intentionally left.
- **Spline** — removed entirely (was half-implemented).
- **Symmetric constraint** — out of scope (planegcs `p2p_symmetric_ppl` exists but not wired).
- **glTF / GLB export** — needs a custom WASM build; not pursued.
- **OBJ import** — engine path exists but `RWObj_CafReader` traps with `null function` (unbound symbol) in
  the prebuilt `opencascade.full.wasm`; needs a custom WASM build.
- **Model box/crossing select** — model faces/edges/vertices stay single-pick (sketch box/crossing is done).
- **Shape validity check / shape healing** (`BRepCheck_Analyzer`, `ShapeFix_*`) — not planned.
- **Boolean exact-history resolution** — `src/cad/engine/history.ts` is a ready scaffold over
  `BRepTools_History`, but for the current selection model (selection-origin == use-point) fingerprints
  already re-anchor selections across renumbers. Not being built; scaffold left in place.
- **CadQuery / OCP kernel** — same OCCT kernel we already wrap, no client-side runtime, and we already beat
  it on constraints. Evaluated and rejected; mined for the selector system (done) instead.

---

## Deterministic topology & stable selections

The classic CAD **topological-naming problem**: face/edge selections used to be stored as positional
ordinal indices (`face-N`/`edge-N`) that renumber on any topology-changing edit. **Status: ✅ complete**
for this app's op set. What shipped:

1. **Deterministic build order** (`buildOrder.ts`) — `orderKey = sequence ?? createdAt`, tie-broken by
   `id`, shared by the worker rebuild and the feature tree so they never disagree.
2. **Geometric fingerprints** (`fingerprint.ts`, pure/`oc`-injected) — anchor a sub-shape to its geometry
   (surface/curve type + GProp measure + centroid + sorted OBB half-sizes). `matchFingerprint` refuses
   ambiguous matches rather than guessing.
3. **Stable refs + lazy capture** — selections persist as `GeometryRef = string | StableRef`; bare
   `edge-N` still works. `resolveSubShapes` re-finds by geometry, falls back to ordinal, and reports
   unresolved refs loudly. Captures ship in `rebuildComplete` and persist without bumping `version`.
4. **Snapshot undo/redo** — one `CADProject` snapshot per `version` change; `undo`/`redo` across two stacks.

**Gotchas for whoever extends this**
- `useOpenCascade` is instantiated **once** in `CADLayout` — a second call spawns a separate worker with
  isolated shape storage.
- Unit tests mock OCC (`mockCtx`); real geometric validity is **e2e / browser only**. Keep fingerprint and
  rebuild logic pure and `oc`-injected so it stays mockable.
- The worker's **single interleaved** sketch+feature pass is intentional (external-geometry sketches
  re-project against `currentBody` at their point in the order). Do **not** split into "all sketches then
  all features".

---

## Known architectural debt

Not bugs, but flagged for whoever does the next substantial pass (each needs real e2e/browser verification,
not a mechanical edit):

- **Constraint-solver pipeline runs in the UI layer** (`CADLayout.tsx`: `mapElementsToPrimitives`,
  `inferAutoConstraints`, `createConstraint`) instead of behind `src/worker/bridge` — a layering violation
  per CLAUDE.md's own architecture doc.
- **`viewportStore` has three parallel "something is happening on the canvas" flags**
  (`draggingDimensionLabel`, `pendingSketchOnFace`, `extrudePreview`) — a generalized `interactionMode`
  union would scale better.
- **`handleRebuild` re-implements** extrude/revolve construction already in
  `handleExtrudeSketch`/`handleRevolveSketch`, and re-derives boss-vs-cut by re-testing `feature.type`
  rather than carrying an `isCut` flag.
- **Worker dispatch has no request-id correlation** — a targeted sketch build and a version-bump rebuild
  can race against the same worker-side `shapeStorage`.
- **`OCCModel.tsx` per-edge hover cylinders / highlight geometry** are unmemoized and recompute on every
  hover/selection change.
