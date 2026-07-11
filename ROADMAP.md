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
- ✅ **One type per file** — files that declared more than one `interface`/`type` (e.g. `viewportStore.ts`,
  `history.ts`, `Fingerprint.ts`, `Sketch.ts`, `MeasurementData.ts`, `constraintAnchors.ts`) split into
  one-type-per-file, matching the existing `cad/types/operations/*.ts` convention; all importers updated.
  Follow-up pass split the remaining offenders too: `SubShapeKind`, `ShapeType`, `ImportFormat`,
  `MeasureType`, `SketchGroupType`, `SketchPrimitiveType`, `FeatureTreeItemType`, `ConstraintKind`
  (`cad/types`), and `OperationButtonVariant`, `OperationItem`, `PolyPoint`, `Vec3`/`Bounds` (frontend) each
  now live in their own file, with data-model `Props`/options interfaces intentionally left co-located with
  their component per existing convention. Also fixed a cross-layer leak: `PlanegcsConstraint` (a DTO used
  by both engine and UI) had been living in `cad/engine/sketch/`; moved to `cad/types/sketch/`, and several
  UI files importing `ConstraintInput` via the engine's `constraintFactory.ts` re-export were switched to
  import it directly from `@/cad/types`.
- ✅ **One operation per file (engine)** — `advancedModeling.ts`, `analysis.ts`, `modifications.ts`, and
  `transforms.ts` split into `advancedModeling/{sweep,loft}.ts`, `analysis/{measureShape,measureBetween}.ts`,
  `modifications/{fillet,chamfer,shell,offset,shared}.ts`, and `transforms/{move,rotate,mirror,scale,
  applyTransform}.ts`, each with an `index.ts` barrel so existing relative imports resolve unchanged.
  Single-consumer "shared" files (e.g. `analysis/helpers.ts`) were inlined into their one caller rather than
  kept as misleadingly-named shared modules. Build/test/lint clean.
- ✅ **operations.ts split** — the ~879-line `operations.ts` broken into `operations/{shared,sketch/*,primitives/*,
  boolean/*,rebuild/handleRebuild,faceGeometry,edgeLoop,resolveSelector,exportShape,measure*Handler}.ts` with an
  `index.ts` barrel preserving the `@/cad/engine/operations` import path; build/test/lint clean, and the
  extracted primitive/boolean builders and `handleRebuild`'s dispatch logic were independently line-by-line
  parity-checked against the original before commit.

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
- **`handleRebuild`'s per-op strategies re-implement** extrude/revolve construction already in
  `handleExtrudeSketch`/`handleRevolveSketch` (see "Rebuild strategy table" below — the boss-vs-cut
  re-derivation from `feature.type` is now confined to each strategy's own `combine` decision instead of
  leaking into the shared loop, but the duplicate OCC construction code itself is still separate).
- **Worker dispatch has no request-id correlation for the state-mutating ops** — a targeted sketch build
  and a version-bump rebuild can race against the same worker-side `shapeStorage`. (The 5
  `requestId`-carrying, single-response ops — `resolveSelector`/`exportShape`/`measureShape`/
  `measureBetween`/`getEdgeLoop` — now do correlate via `occWorkerClient`'s generic `call()` (moved from
  `useOpenCascade` in the OCC worker singleton refactor below), see below;
  this note is about `buildSketch`/`extrudeSketch`/`revolveSketch`/`rebuild`, which stay event-style.)
- **`OCCModel.tsx` per-edge hover cylinders / highlight geometry** are unmemoized and recompute on every
  hover/selection change.

## Rebuild strategy table (2026-07-11)

Per Architecture review candidate #2 ("make `handleRebuild`'s feature dispatch a strategy table"):
the ~180-line if/else chain dispatching 20+ feature types in `handleRebuild.ts` is now a registry
(`src/cad/engine/operations/rebuild/strategies/registry.ts`, `FEATURE_STRATEGY_REGISTRY`) mapping each
`FeatureOperation` to a `FeatureStrategy` function, mirroring the existing `drawTools/registry.ts` and
`OPERATION_PANEL_REGISTRY` patterns. One file per operation group under `strategies/`
(extrude/revolve/import/primitive/sweepLoft/modifications/transform/boolean/measure); each returns a
tagged `StrategyResult` (`produce` — new solid, loop auto-combines via a `combine: 'union'|'subtract'`
field the strategy itself decides; `replace` — body swapped in place; `noop`). The loop in
`handleRebuild.ts` no longer branches on `feature.type` at all — the boss/cut/isCut decision that used
to live in the shared loop now lives in each producing strategy, closing the "no locality" seam the
review flagged (the extracted pure helpers were tested; the wiring around them wasn't). A feature type
missing a registry entry still fails loudly instead of silently no-opping.

`modifications.ts` collapsed fillet/chamfer/shell/offset (4 near-identical functions differing only in
apply-fn/param-key/SubShapeKind) into one `makeModificationStrategy` config-driven factory, found during
a `/simplify` pass alongside the `combine`-field extraction (a `/simplify` altitude finding: the initial
cut across the loop still special-cased `feature.type` for the auto-union decision).

Added `strategies/strategies.test.ts` — direct tests for `extrudeStrategy` (face-normal-based direction,
regression-tested the same way as `operations.test.ts`), `revolveStrategy`, `booleanStrategy` (operand
collection, insufficient-operand no-op), `filletStrategy`/`transformStrategy` (no-op with no body),
`measureStrategy`, and a registry-completeness check that every body-affecting `FeatureOperation` has an
entry. Full suite (635 tests) + build pass; verified live in-browser (Entities panel: 10 faces/21 edges,
unchanged before/after, on the same multi-feature persisted project — primitives, sketches, booleans).

## Worker bridge: generic call() for correlated ops (2026-07-11)

Per Architecture review candidate #1 ("collapse the worker message pipeline into a typed call
registry"): the 5 `requestId`-carrying, single-response worker ops — `resolveSelector`, `exportShape`,
`measureShape`, `measureBetween`, `getEdgeLoop` — now go through one generic `call(type, requestId,
payload)` in `useOpenCascade.ts` (`src/worker/types/messages.ts` holds the `CorrelatedCallMap` typing
the request/response pair per op) instead of 5 near-identical `useCallback` forwarders + 5 `onXxx` option
callbacks + 5 `onmessage` switch cases. Each now returns a `Promise` resolving to the worker's response.

Scope was kept types-preserving: the 27 DTO files in `requests/`/`responses/` and their two `index.ts`
barrels are unchanged — only the dispatch/correlation layer collapsed. `buildSketch`/`extrudeSketch`/
`revolveSketch`/`rebuild` stay event-style (they fan out into multiple `setState` calls, not a single
result) and were left alone.

Downstream, `useOpenCascadeBridge.ts` dropped its hand-rolled `pendingSelectorResolutions`/`pendingExports`
correlation maps and the `onMeasuredRef`/`onMeasuredBetweenRef` deferred-callback indirection
(`setMeasuredHandlers`) in favor of directly awaiting the new promises; `useMeasurement.ts` now awaits
`measureShape`/`measureBetween` instead of registering handlers.

Also removed 2 dead `WorkerRequest` union members with no worker handler: `createPrimitive`,
`booleanOperation` — flagged, not deleted (kept DTO files per scope above); worth a follow-up decision on
whether they're future work or truly dead.

Added `call()` requestId-correlation tests to `useOpenCascade.test.ts` (out-of-order resolution, exact
posted-message shape, no double-resolve on a duplicate response). Full suite (625 tests) + build pass;
verified live in-browser (Entities panel shows correct 14-face/33-edge rebuild, Measure tab returns a real
volume/bbox through the new `call()`-based `measureShape` path, no new console errors).

## OCC worker singleton + occStore + rebuild scheduler (2026-07-11)

Per Architecture reviews #3 ("dissolve the double forwarding stack"), #4 ("extract a rebuild
scheduler"), and #5 ("delete the CADViewport pass-through"):

- **Pure rebuild scheduler** — `src/cad/engine/rebuild/rebuildScheduler.ts` exports
  `shouldRebuild(prev, next): 'rebuild' | 'remesh' | 'clear' | 'none'`, encoding the policy that used to
  be smeared across two coupled `useEffect`s with `useRef` guards in `useOpenCascadeBridge.ts`. Directly
  unit-tested (undo/lower-version still rebuilds via `!==` not `>`, tessellation-only change remeshes,
  project-id change clears, no-op case) in `rebuildScheduler.test.ts`.
- **Worker singleton + zustand store** — `useOpenCascade` (React hook, one Worker per instantiation) and
  `useOpenCascadeBridge` (the renaming/re-exporting wrapper) are both deleted. Replaced by:
  - `src/frontend/shared/occStore.ts` — zustand store (mirrors `viewportStore.ts`) holding worker-output
    state: `status/progress/error/mesh/currentShapeId/currentFeatureShapeId/sketchEdges`.
  - `src/worker/bridge/occWorkerClient.ts` — a module-level singleton: spawns the Worker once, owns
    `onmessage`/`call()`/`pendingCalls`, writes `occStore` directly, and exposes both imperative ops
    (`buildSketch`, `rebuild`, `getFaceGeometry`, …) and an event-subscription API (`on('sketchBuilt', …)`
    etc.) for the orchestration that used to live in `useOpenCascadeBridge`'s option callbacks. The old
    "instantiate the hook exactly once" footgun (see project memory) is now moot — an ES module is
    naturally a singleton.
  - `src/frontend/ui/layout/hooks/useOCCSync.ts` — the one remaining slice of React glue: subscribes to
    `occWorkerClient` events (via a ref-to-latest-args pattern, replacing the old `optsRef`) and forwards
    them into `useCADState` setters, and drives rebuild/remesh/clear off `shouldRebuild`. Returns nothing;
    components read `useOccStore` selectors and call `occWorkerClient` functions directly.
  - `CADLayout.tsx` still assembles a stable `occ` object (typed as `OccBridgeValue` in
    `CADLayoutContext.tsx`) from store selectors + client functions, so downstream consumers
    (`CADSidebar`, `useMeasurement`, `useSketchPlaneSelection`, `useViewportSelection`, `useProjectIO`,
    `useOperationPanel`) were left unchanged — only the CADMainCanvas/viewport layer was re-pointed
    directly at the store (see below).
- **`CADViewport.tsx` pass-through deleted** — its only real logic (the `activeSketch` lookup by
  `activeSketchId`) moved into `OpenCascadeViewport`, which now also reads
  `mesh/status/error/progress/sketchEdges` from `useOccStore` itself instead of taking them as 6 props.
  `CADMainCanvas.tsx` renders `OpenCascadeViewport` directly.

Tests: `useOpenCascade.test.ts` → `occWorkerClient.test.ts` (event-subscription tests replace the
stale-closure `optsRef` tests; `call()`/`pendingCalls` correlation tests carry over; added direct
`useOccStore`-write assertions for `rebuildComplete`/`error`/`clearMesh`). `CADLayout.test.tsx` rewritten
to mock `occWorkerClient` (capturing `on()` subscribers) and seed `useOccStore` instead of mocking the
deleted hook. Full suite (645 tests) + `tsc --noEmit` + build pass; verified live in-browser: kernel
reaches ready, primitive add → rebuild → 7 faces/18 edges (real geometry, not degenerate), undo (lower
version) still triggers a rebuild, no new console errors.

## React Doctor cleanup (2026-07-09)

Fixed the top 3 issue groups from a full-codebase `react-doctor` scan (score 62/100, 30 remaining
performance warnings — see below for what's left):

- **Barrel imports** (4 sites) — `measureBetweenHandler.ts`, `measureShapeHandler.ts`,
  `handleRebuild.ts`, `sketch/externalGeometry.ts` now import directly from source modules instead of
  `analysis/`, `modifications/`, and `types/` barrels.
- **Repeated deep property access in loops** — hoisted `item.data.id` in `handleRebuild.ts` and
  `workplane.normal.{x,y,z}` in `sketchBuilders.ts` (circle/ellipse/arc cases) into local consts.
- **Chained `.filter().map()` / `.map().filter()` / `.filter().forEach()`** (11 sites) — collapsed into
  single-pass `flatMap`/`for...of` in `evaluate.ts`, `sketchGroups.ts`, `contextTarget.ts`,
  `SketchWireframes.tsx`, `SketchOverlay.tsx`, `useCADState.ts`, `OperationPanel.tsx`.

Verified via `npx react-doctor@latest --verbose --category performance`: none of the three rules
(`no-barrel-import`, `js-cache-property-access`, `js-combine-iterations`) appear in the remaining findings.
Full test suite (589 tests) and build pass unchanged.

## React Doctor cleanup, continued (2026-07-10)

Worked through the rest of the full-codebase scan (132 findings → 78; score 62 → higher, all remaining
are `warning` severity). Fixed, by rule:

- **`no-transition-all`** (9 sites) — `CADLayout.tsx`, `EntitiesPanel.tsx`, `TreeItem.tsx`,
  `SketchEntitiesPanel.tsx`, and the operation button components now list explicit properties
  (`background-color`, `border-color`, `opacity`, `color`) instead of `all`. Did **not** include `width`
  on the sidebar collapse transition — animating `width` re-triggers layout every frame
  (`no-layout-transition-inline`), and there's no cheap CSS-only fix for a real reflow-causing size
  change, so the sidebar width now snaps instantly while background/border still animate.
- **`no-large-animated-blur`** (6 sites) — `backdropFilter: blur(12px)` → `blur(8px)` in
  `OpenCascadeViewport.tsx`, `SketchConstraintToolbar.tsx`, `SketchConstraintList.tsx`.
- **`no-tiny-text`** (2), **`prefer-module-scope-static-value`** (1, `SketchHotkeys.tsx`'s `kbdStyle`
  hoisted to module scope), **`rerender-lazy-ref-init`** (1, `SketchOverlay.tsx`'s `Matrix4` ref).
- **`no-array-index-as-key`** (7) — replaced with content-derived keys (coordinates, `kind-index`
  composites, named ids) in `SketchWireframes.tsx`, `SketchRenderer.tsx`, `MeasurePanel.tsx`,
  `SketchOverlay.tsx` (×4).
- **`js-set-map-lookups`** (3 of 7 real; 4 were false positives — `dataTransfer.types.includes()` and a
  2-item static `disabledOperations` array, both below the rule's own "~10 items" FP threshold) —
  `Set`-ified in `OCCModel.tsx` and `SketchEntitiesPanel.tsx`.
- **`js-index-maps`** (5, all in `sketchBuilders.ts`) — one `Map` built before the primitive-translation
  loop instead of 5 `.find()` calls inside it.
- **`unused-file`** (8, user-confirmed dead: `CanvasPlaceholder{,Props}.ts(x)`, `ErrorBoundary{Props,State}.ts`,
  `hooks/use-mobile.tsx`, 3 worker request/response type files) and **`unused-export`** (3: a duplicate
  `SelectorError` alias, an actually-dead `SketchPrimitiveType` enum — see gotcha below — and an
  internal-only `SketchWireframe`/`getItemIcon` export) — deleted.
- **`only-export-components`** (4, `ReferencePlanes.tsx` + `TreeItem.tsx`) — non-component exports moved
  to a new sibling `referencePlaneGeometry.ts`; `getItemIcon` un-exported (only used locally).
- **a11y** (`click-events-have-key-events`, `no-static-element-interactions`) — the sketch constraint
  badge now has `onKeyDown` (Enter/Space) — later converted to a real `<button>` (see below).
- **`no-effect-chain`/`no-chain-state-updates`/`no-derived-state-effect`** in `CADLayout.tsx`'s Measure
  feature — merged two effects that fired off the same `[activeSidebarTab, currentFeatureShapeId]`
  dependencies into one.
- **`exhaustive-deps`** (2, `SketchOverlay.tsx`) — added a missing `setHoveredElementId` dependency to
  an effect and a `useCallback`.

**Gotcha found along the way:** `src/cad/types/sketch/SketchPrimitive.ts` imports `SketchPrimitiveType`
from `'./Sketch'`, which doesn't export it — a pre-existing `TS2305` error `bun run build` never catches
(Vite doesn't type-check; `npx tsc -p tsconfig.app.json` does). Fixing the import surfaces ~20 real
`"point"`/`"line"` string-literal-vs-enum mismatches across `sketchBuilders.ts`, `SketchSolver.ts`, and
their tests — the codebase's real convention is plain string literals for `SketchPrimitive.type`, not the
enum. Left the broken import as-is and deleted the now-confirmed-dead enum instead; the string-literal-vs-
enum cleanup is a separate, larger type-system task if it's ever worth doing.

**Deferred as false positives** (per each rule's own validation criteria, not fixed):
`no-unknown-property` (3, react-three-fiber `<line>` elements false-flagged as HTML/SVG),
`js-set-map-lookups` (4: `dataTransfer.types`, a 2-item static array).

**Deferred as out of scope for a mechanical pass** (architecture-level, need dedicated review/tests):
- **`no-inline-exhaustive-style`** (8) — would require introducing CSS Modules into a codebase that
  uses inline Mantine `style` props everywhere; a one-off partial migration for 8 sites is inconsistent
  without a design-system decision.
- **`no-giant-component`** (`OperationPanel.tsx`) — ✅ done via the Strategy/registry split below
  (810 → ~120 lines). `SketchOverlay.tsx` — ✅ done, see the dedicated entry below (1654 → 456 lines).
  `CADLayout.tsx` — ✅ done, see the dedicated entry below (1409 → ~330 lines).
  `OpenCascadeViewport.tsx` — ✅ done, see the dedicated entry below (410 → ~215 lines). The remaining 2
  (`OCCModel.tsx`, `SketchRenderer.tsx`) are still real, multi-hour restructuring jobs, not lint fixes.
- **`OperationPanel.tsx` per-operation Strategy + registry-factory split** — ✅ done, all ~21
  `FeatureOperation`/`TransformOperation` variants that ever reach the panel are migrated (only
  `FeatureOperation.IMPORT`, which has no parametric params UI, and any stray `SketchOperation` fall
  back to a "not implemented" message). `OperationPanel` used to fan every operation through five
  parallel `switch`/`if` ladders (render fields, build params, validate, two init effects) keyed on the
  same `operation` — a GoF **Strategy** pattern crying out to happen (Command was considered and
  rejected: the app already has a command/memento layer at the `Feature`/parametric-history level, so
  the panel only needs to *produce* params, not execute/undo them).
  `src/frontend/ui/operations/strategies/` holds one self-contained `forwardRef`+`useImperativeHandle`
  component per operation (`OperationPanelProps`/`OperationPanelHandle` in `strategies/types.ts`), each
  owning its own local state (mostly lazy `useState` initializers, not the old prop-driven
  `useEffect` — incidentally also fixes the `no-adjust-state-on-prop-change` finding this file used to
  have), validity, and `buildParams`. `registry.ts` is a typed
  `Partial<Record<Operation, OperationPanelComponent>>` factory; `OperationPanel.tsx` is now a ~120-line
  shell that looks up the registry and renders header/content/footer chrome around whatever it finds —
  it no longer has an operation-specific line of logic in it. Two components serve multiple enum
  variants via the new `operation` prop passed through `OperationPanelProps`: `ExtrudePanel`
  (EXTRUDE_BOSS/EXTRUDED_CUT) and `RevolvePanel` (REVOLVED_BOSS/REVOLVED_CUT) derive `isCut`;
  `BooleanPanel` (UNION/INTERSECT) derives the boolean mode. Shared logic factored into
  `strategies/shared/`: `useEdgeSelection`/`useFaceSelection`/`useFeatureSelection` (viewport/tree-click-append
  hooks), `SelectorRuleInput` (select-by-rule text/preset/live-checkbox block), `useDefaultSketchId`
  (extrude/revolve's shared initial-sketch-selection logic). Also fixed a latent bug found along the
  way: the legacy `MEASURE` case referenced `MeasureParams` without importing it — `bun run build`
  (Vite/SWC, transpile-only) never caught it; `npx tsc --noEmit` does, and is now part of this file's
  verification loop since Vite alone isn't sufficient for a refactor this size.
  Verified in-browser end-to-end across a representative slice — Box/Sphere (primitives), Fillet (both
  a successful and a geometrically-invalid apply, to confirm error paths aren't regressed), Move
  (transform), Union (boolean, multi-feature), Measure (evaluate) — all produced real feature-tree
  entries and real geometry (verified via Entities panel face/edge counts) with zero new console
  errors. `npx tsc --noEmit`, `bun run lint`, `bun run build`, and the full 589-test suite are all
  clean. Extrude/Revolve/Sweep/Loft were not driven through a live sketch in the browser (synthetic
  pointer events on the sketch canvas did not register a draw in this session — worth a follow-up
  investigation, see `[[r3f-stable-event-handlers]]` / `[[r3f-raw-listener-vs-effect-order]]` memories
  for prior related pointer-event gotchas in this exact viewport) but are mechanical extractions of the
  previously-working legacy code (state init, params construction, and the extrude-preview effect were
  copied over unchanged) and are exercised indirectly by `CADLayout.test.tsx`'s sketch-creation tests.
- **`prefer-useReducer` in `OperationPanel.tsx`** — ✅ superseded. The single-panel `useReducer`
  (`PanelState`/`panelReducer`) built for this finding was a real improvement over ~30 flat `useState`
  hooks, but it's now gone entirely — every operation moved to its own Strategy component with its own
  local state (see the entry above), which is a stronger fix: each component only has the 2-5 fields
  its own operation actually needs, instead of one struct holding all ~30 fields for every operation at
  once.
- **`no-derived-state`/`no-event-handler`/`no-adjust-state-on-prop-change`/`no-cascading-set-state`/
  `no-chain-state-updates`/`no-effect-chain`** — a handful remain in
  `SketchOverlay.tsx` — same systemic root cause: local state initialized from
  props via `useEffect`. `SketchOverlay.tsx`'s state is a poor reducer fit (independent
  transient-drawing vs. persisted grid prefs, updated at different times), so it was left as-is. Touches
  `SketchOverlay.tsx`'s
  tool-switching reset effect (line ~348), which is deliberately *not* touched here: past incidents
  (see `[[r3f-stable-event-handlers]]` memory) show refactoring this exact pointer/event-handler wiring
  can silently break sketch interactions.

Verified via `npx react-doctor@latest --verbose` (132 → 78 findings) plus a manual browser pass
(`bun run dev` + Playwright): selected Front Plane, entered sketch mode, drew a rectangle (auto-added 4
constraints), finished the sketch — confirming the `SketchOverlay.tsx` dependency-array changes didn't
break tool-switching or pointer handling. Full test suite (589 tests) and build pass throughout.

### `SketchOverlay.tsx` breakup (1654 → 456 lines)

Split into four independent, separately-committed phases (each verified with `bun run build`,
`bun run lint`, and the full test suite before moving on):

1. **Pure geometry/constants extracted** — `getDistanceToElement`/`projectPointOntoLineSegment` →
   `cad/engine/sketch/elementHitTest.ts`; `arcElementFrom`/`lastEndTangent` →
   `cad/engine/sketch/arcElementFactory.ts`; `NO_RAYCAST`/`CONSTRAINT_ICONS` →
   `canvas/sketch/sketchOverlayConstants.ts`. Added unit tests for the two geometry modules (they were
   previously untested, hoisted-but-inline functions).
2. **Stateful hooks extracted** to `canvas/sketch/hooks/`: `useSketchSnapping` (grid/constraint
   snapping + the snap-candidate point sets), `useDimensionTool` (Dimension tool's 2-pick state),
   `useSketchBoxSelection` (the rubber-band box-select canvas-listener effect), and
   `useSketchKeyboardActions` (global keyboard shortcuts). Preserved the existing
   ref-mirrored-state pattern (see `[[r3f-stable-event-handlers]]` memory) throughout — each hook still
   exposes/reads refs where the original did, since that's what keeps the plane mesh's pointer handlers
   referentially stable across clicks.
3. **Draw-tool switches replaced with a Strategy/registry**, mirroring the `OperationPanel` split
   above: every geometry-placing `SketchOperation` (point/line/rectangle/circle/polygon/arc families)
   got its own `DrawToolHandler { onClick, onPreview }` under `cad/engine/sketch/drawTools/`, assembled
   into `drawToolRegistry`. `handlePlaneClick`/`handlePlaneMove` shrank from two ~250-line switches to a
   registry lookup + delegate. Added `registry.test.ts` covering each tool family.
4. **JSX split into subcomponents** under `canvas/sketch/components/`: `SketchPlaneAndGrid`,
   `SketchOriginGizmo`, `SketchElementsLayer`, `SketchConstraintBadges`, `SketchDrawingFeedback`,
   `SketchConstraintSnapHighlights`. `SketchOverlay.tsx` now only owns state/handlers and composes
   these pieces.

Left deliberately untouched: the tool-switching reset effect and the `no-derived-state`/
`no-event-handler`/effect-chain findings noted above — same reasoning as before (poor reducer fit,
risk of silently breaking pointer/tool-switching interactions). Full suite (615 tests, up from 603 —
new tests for the extracted geometry/registry modules) and build pass after each phase.

### `OpenCascadeViewport.tsx` breakup (410 → ~215 lines)

The component had grown into three jobs jammed together: hosting the R3F `<Canvas>`/`<Scene>`, rendering
the sketch-mode HUD overlays, and wiring the right-click context menu. Extracted the self-contained
overlay blocks into sibling components under `src/frontend/canvas/opencascade/` (matching the existing
`LoadingOverlay`/`ErrorOverlay`/`SelectionDisplay` pattern), leaving the main file a thin orchestrator:

- `SketchModeControls.tsx` — top-right Cancel/Finish + element-count HUD.
- `SketchPlanePrompt.tsx` — top-center "Select a sketch plane" prompt.
- `SketchConstraintsMenu.tsx` — bottom-center snapping-constraint toolbar; owns and exports the
  `ConstraintType` union (`'none' | 'point' | 'edge' | 'midpoint' | 'center'`). State stays lifted in the
  parent since `Scene` also consumes `activeConstraint`; the menu takes `activeConstraint`/`onChange`.
- `SketchSelectionBox.tsx` — the box/crossing rubber-band overlay; reads `sketchSelectionBox` from
  `viewportStore` itself rather than through a prop.
- `ViewportEmptyState.tsx` — the "No geometry to display" placeholder.
- `contextMenu/useViewportContextMenu.ts` — the `onContextMenu` handler extracted to a memoized hook
  keyed on `inSketchMode`.

Incidental cleanups: moved the stray mid-file `import { SketchRenderer }` (was on line 64) up into the
import block, and dropped now-unused Mantine/icon imports. Verified with `bun run build`, `bun run test`
(615/615 passing), and `bun run lint` (no new findings — the 3 `any` errors on the props interface are
pre-existing and carried over verbatim).

### `OCCModel.tsx` breakup (424 → ~55 lines)

The scene-graph component mixed four independent render concerns plus duplicated geometry logic.
Split under `src/frontend/canvas/opencascade/` into a thin orchestrator + focused pieces:

- `occGeometry.ts` — pure geometry builders (`buildFaceGeometry`, `buildFaceHighlightGeometry`,
  `groupEdgeSegmentsByEdge`). Collapsed the two near-identical face-highlight `useMemo`s (hovered +
  selected) into one `buildFaceHighlightGeometry` helper. Added `occGeometry.test.ts`.
- `FaceMesh.tsx` / `EdgeWireframe.tsx` / `EdgeHoverCylinders.tsx` / `VertexPoints.tsx` — each owns its
  own local hover state and refs.
- `useDisableRaycastInSketchMode.ts` — shared hook so each child self-contains its raycast toggle
  instead of the parent plumbing refs to all of them.
- Dropped the now-redundant internal edge-hover state (the `viewportStore` field is set alongside it and
  is what both edge components read).

Verified with `bun run build` and `bun run test` (622/622 passing).

### `SketchRenderer.tsx` breakup (445 → ~30 lines)

Split under `src/frontend/canvas/sketch/` following the existing `components/` + `hooks/` convention:

- `dimensionGeometryUtils.ts` — pure `perpUnit` / `centerPointId` / `DEFAULT_LABEL_DISTANCE`.
- `components/DimensionAnnotation.tsx` — the dimension-drawing subcomponent (was an inline component).
- `hooks/useDimensionDrag.ts` — all label drag/select state, the screen-to-plane raycast, and the
  per-constraint highlight/offset/arrow-flip helpers.
- `components/SketchPrimitives.tsx` — the line/point/circle/arc render switch.
- `components/SketchAnnotations.tsx` — the dimension + geometric-constraint render switch; owns
  `sketchCentroid`/`outwardPerpUnit` and calls `useDimensionDrag` (its sole consumer).

Verified with `bun run build` and `bun run test` (622/622 passing).

### `CADLayout.tsx` breakup (1409 → ~330 lines)

Same `hooks/` + `components/` pattern as the `SketchOverlay.tsx` breakup above, under a new
`src/frontend/ui/layout/` directory (`CADLayout.tsx` itself stays directly under `src/frontend/ui/`
and is now a thin orchestrator: calls the hooks below in dependency order, then composes three JSX
components).

- `layout/ioOperations.ts` — pure, already free-standing: `SKETCH_TOOL_OPERATIONS`,
  `IMPORT_FORMATS`/`EXPORT_FORMATS`, `parseIoOperation`.
- `layout/hooks/`: `useOpenCascadeBridge` (the `useOpenCascade(...)` call, its callbacks, and the
  rebuild/tessellation/clear-mesh effects — largest hook, most others depend on values it returns),
  `useMeasurement`, `useSketchEditing` (sketch element/constraint mutation handlers, all funneling
  through `applySketchElements`), `useSketchPlaneSelection` (face/plane-driven sketch creation +
  the Sketch toolbar button dispatch), `useViewportSelection` (face/edge/vertex click handling),
  `useProjectIO` (new/open/save/export + CAD import/export), `useOperationPanel`, `useHeaderHeight`,
  `useUndoRedoShortcut`.
- `layout/components/`: `CADHeader` (Toolbar + OperationsBar), `CADSidebar` (OperationPanel + Feature
  Tree/Entities/Measure tabs — the largest extracted piece), `CADMainCanvas` (CADViewport +
  SketchConstraintToolbar/List + ViewportContextMenu).

One cross-hook wiring wrinkle: `useOpenCascadeBridge`'s `onMeasured`/`onMeasuredBetween` worker
callbacks need setters that live in `useMeasurement`, which itself needs `currentFeatureShapeId` back
from the bridge — resolved with a `setMeasuredHandlers` indirection (bridge exposes it, `useMeasurement`
calls it in an effect) rather than restructuring hook call order, since JS closures resolve free
variables lazily and the callbacks are only invoked long after both hooks have run in the same render.

Verified with `bun run build`, `bun run test` (614/615 passing — the one failure,
`SketchOverlay.dimension.test.tsx`, reproduces identically on `main` pre-refactor and in isolation, so
is pre-existing flakiness unrelated to this change), `bun run lint` (455 problems vs. 458 on `main`,
no new findings), and a manual `bun run dev` + Playwright pass: selected Front Plane, entered sketch
mode, drew with the Corner Rectangle tool, Finish Sketch, Undo — all wired through with zero new
console errors (only pre-existing `TreeItem.tsx` inline-style shorthand warnings).

#### Follow-up: cut `CADHeader`/`CADSidebar`/`CADMainCanvas` prop counts (Zustand + Context hybrid)

The breakup above still threaded every value through explicit props: `CADHeader` ~20, `CADSidebar`
~33, `CADMainCanvas` ~32 — about 85 props total. Fixed with two additions, both scoped to
`src/frontend/ui/layout/`, not app-wide:

- **`cadLayoutUiStore.ts`** (Zustand, same pattern as `viewportStore.ts`) — holds the plain
  read/write UI state that used to live in scattered `useState` calls: `activeSidebarTab`,
  `operationPanelOpen`/`editingFeatureId` (from `useOperationPanel`), and
  `measurement`/`measurePicks`/`betweenMeasurement` (from `useMeasurement`). `CADSidebar` — the
  component that actually owns this UI — subscribes to it directly via selectors instead of
  receiving it as props or context, so e.g. a measurement pick no longer re-renders
  `CADHeader`/`CADMainCanvas`. `useMeasurement`/`useOperationPanel` kept their external function
  signatures; only their internals swapped `useState` for store reads/writes.
- **`CADLayoutContext.tsx`** (plain React Context, no Zustand) — distributes the singleton-hook data
  (`cadState` from `useCADState`, `occ` from `useOpenCascadeBridge` — both must only be instantiated
  once, per this file's `useOpenCascade`/`useCADState` singleton note) and the handler-bag hooks
  (`sketchEditing`, `sketchPlaneSelection`, `viewportSelection`, `projectIO`, `operationPanel`) that
  close over that singleton state. `CADLayout.tsx` still calls every hook exactly once and builds one
  `contextValue`; `CADHeader`/`CADSidebar`/`CADMainCanvas` now take **zero props**, calling
  `useCADLayoutContext()` (plus `useCadLayoutUiStore` selectors in `CADSidebar`'s case) instead.

Deliberately not done: moving `cadState`/`occ` into Zustand (would just relocate the same
singleton-instantiation constraint into a different API, not remove it); `React.memo`-wrapping the
three components (the Context value object still changes identity every render since it isn't
memoized, so memoizing consumers wouldn't reduce re-renders without also splitting the context —
not needed since `CADLayout` already re-renders its whole subtree on any state change today, same
as before this change); splitting `CADLayoutContext` into multiple smaller contexts for
render-scoping (the frequently-changing fields already moved out to the Zustand store, so what's
left in the context changes at roughly the same cadence as `CADLayout` itself).

One test-infrastructure note: `cadLayoutUiStore` is a module-level singleton like `viewportStore`,
so `CADLayout.test.tsx`'s `beforeEach` now resets it (`useCadLayoutUiStore.setState({...})`) to
prevent a tab/measurement change in one test leaking into the next test's initial render — the same
risk `viewportStore` already has but wasn't previously exercised by any test touching sidebar-tab
state across test boundaries.

Verified with `bun run build`, `npx tsc -p tsconfig.app.json --noEmit` (329 pre-existing errors vs.
331 on `main`, all in unrelated OpenCascade WASM typings — no new errors, one fixed: an
`Operation`-vs-`FeatureOperation|TransformOperation|SketchOperation` cast that had to be restored
when `OperationPanel`'s prop moved out of a typed prop interface), `bun run test` (615/615, including
the previously-flaky `SketchOverlay.dimension.test.tsx` passing clean this run), `bun run lint` (456
problems, same as `main` — no new findings), and a manual `bun run dev` + Playwright pass: loaded a
project with existing bodies (confirms `useOpenCascadeBridge`'s rebuild-on-mount still fires),
switched to the Measure tab and confirmed live volume/bounding-box data renders (exercises the
Zustand-migrated `useMeasurement` path end-to-end), and clicked a viewport face to confirm the pick
flow still fires with zero new console errors.

#### Follow-up: `featureTreeUiStore.ts` — kill `TreeItem`'s recursive prop drilling

A repo-wide audit found the one remaining prop-drilling hotspot after the above: `FeatureTree`/
`TreeItem` (`src/frontend/ui/FeatureTree/`) recursively re-threaded a 7-value prop set
(`selectedItem`, `onSelectItem`, `onToggleExpand`, `onToggleVisibility`, `onEdit`, `onDelete`,
`onReorder`) through every nesting level of `TreeItem`, even though only `item`/`depth`/`isCompact`
actually vary per recursive call.

`selectedTreeItem` itself turned out to be consumed by ~20 files outside the feature tree
(`OperationPanel`, `CADViewport`, `OperationsBar`, several operation-strategy panels,
`ViewportContextMenu`, `OpenCascadeViewport`, `SelectionDisplay`, `useViewportSelection`,
`useSketchPlaneSelection`, `CADHeader`, the `CADState` type, tests, etc.). Two dead ends before
landing on the right shape, worth recording:

1. First pass mirrored `useCADState`'s value into a new `featureTreeUiStore` (Zustand) via a
   `CADSidebar` `useEffect`. That meant two copies of the same state — one commit of lag between a
   selection and the mirror updating — for no real gain.
2. Second pass fixed the state duplication by moving `selectedTreeItem` into `viewportStore.ts`
   itself (right alongside `hoveredTreeItem`, which was already there), with `useCADState.ts` reading/
   writing it via `useViewportStore` selectors instead of local `useState` — this part was a genuine
   improvement and stayed. But it still routed the tree's CRUD/reorder callbacks
   (`onToggleExpand`/`onEdit`/`onDelete`/`onReorder`) through `featureTreeUiStore`, registered by
   `CADSidebar` via another `useEffect`. On reflection this store was never justified: `FeatureTree`
   nests only one level deep (a feature's single associated sketch — see `useCADState.ts`'s
   `featureTree` builder), mounted from exactly one place (`CADSidebar`), so there was no real
   multi-level drilling or independent-branches problem to solve — the classic case for reaching past
   Context to a global store. The store also added a real cost: `featureTreeUiStore` is a
   module-level singleton, and it produced a genuine test-pollution failure this session, requiring a
   `beforeEach` reset — a footgun paid for a benefit that was mostly cosmetic (shorter prop lists, no
   render-frequency win, since every `TreeItem` still subscribes to the same primitive value either
   way).

Landed instead on: `selectedTreeItem` stays in `viewportStore.ts` (right call, kept from pass 2); the
CRUD/reorder callbacks are provided via a plain `FeatureTreeActionsContext`
(`src/frontend/ui/FeatureTree/FeatureTreeActionsContext.tsx`) — `CADSidebar` builds one `useMemo`'d
actions object and wraps `<FeatureTree>` in `<FeatureTreeActionsProvider>`; `TreeItem` reads it via
`useFeatureTreeActions()`. No effect, no registration step, no singleton to reset between tests —
Context is provider-scoped, so `FeatureTree.test.tsx` just wraps each render in the provider like any
other. Mirrors the existing `CADLayoutContext` idiom this codebase already uses for exactly this
kind of "one provider, one consumer subtree" relationship, rather than mixing in a second
state-management primitive for it.

Verified with `bun run build`, `bun run test` (615/615 — `FeatureTree.test.tsx` renders through
`FeatureTreeActionsProvider`; `useCADState.test.ts`/`CADLayout.test.tsx` keep their `viewportStore`
`beforeEach` reset for `selectedTreeItem`, matching the existing `cadLayoutUiStore` reset pattern
since that part of the state remains a module-level singleton), and `bun run lint` (455 problems vs.
456 on `main` — one new fast-refresh warning on `FeatureTreeActionsContext.tsx`, identical in kind to
the pre-existing one on `CADLayoutContext.tsx`; also fixed two pre-existing missing-dependency
warnings while touching `useCADState.ts`'s `useCallback`s along the way).
