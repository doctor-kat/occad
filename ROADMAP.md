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
- **`handleRebuild` re-implements** extrude/revolve construction already in
  `handleExtrudeSketch`/`handleRevolveSketch`, and re-derives boss-vs-cut by re-testing `feature.type`
  rather than carrying an `isCut` flag.
- **Worker dispatch has no request-id correlation** — a targeted sketch build and a version-bump rebuild
  can race against the same worker-side `shapeStorage`.
- **`OCCModel.tsx` per-edge hover cylinders / highlight geometry** are unmemoized and recompute on every
  hover/selection change.

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
  The other 4 (`CADLayout.tsx` 1341 lines, `OpenCascadeViewport.tsx`, `OCCModel.tsx`,
  `SketchRenderer.tsx`) are still real, multi-hour restructuring jobs, not lint fixes.
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
