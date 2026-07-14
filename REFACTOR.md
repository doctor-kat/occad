# Layer-Separation Refactor (in progress)

Goal: make the file tree legibly express capabilities and layers. Three independent
refactors, executed in order. **This doc is the resumable state — update it as steps land.**

## Why (analysis)

`src/cad/engine/` conflated three unrelated kernels: OCC solid modeling (wasm),
planegcs sketch solver (different wasm, no OCC dep), and pure 2D / screen-space math.
`frontend/canvas/` name implied "just visuals" but collides with the sketch domain.
`types/sketch/constraints.ts` packed enum + 14-arm union + planegcs type into one file,
violating the one-type-per-file convention and hiding the constraint capability list.

## Plan / progress

### Step 1 — constraints one-per-file  ✅ DONE (commit landed)
Split `src/cad/types/sketch/constraints.ts` to match the `sketchElements.ts → SketchElement.ts` pattern:
```
types/sketch/constraints/
  ConstraintKind.ts        (enum — the capability list)
  inputs.ts                (14 interfaces: HorizontalInput, CoincidentInput, …; grouped module)
  ConstraintInput.ts       (union barrel over inputs.ts)
  PlanegcsConstraint.ts
```
- Each input interface discriminates on `kind: ConstraintKind.X`.
- Update `types/index.ts` barrel exports.
- Verify: `bun run build` + `bun run test`.

### Step 2 — `frontend/canvas/` → `frontend/viewport/`  ✅ DONE (commit landed)
NOTE: Vite dev server locks the dir → `git mv` on the directory fails with
"Permission denied". Workaround used: per-file `git mv` into the new tree, then
`rm -rf` the empty old dir. Same applies to Step 3 renames while dev server runs.

- `git mv src/frontend/canvas src/frontend/viewport`
- Update all `@/frontend/canvas` imports → `@/frontend/viewport`.
- Update CLAUDE.md architecture section.
- Verify: build + test.

### Step 3 — split `src/cad/engine/`  ✅ DONE (3a + 3b landed)
Target:
```
src/cad/
  solid/       (rename of engine/) — OCC kernel only
  sketch/      — planegcs solver: SketchSolver, constraintFactory, elementsToPrimitives,
                 syncElementsFromPrimitives, autoConstraints
  geometry2d/  — pure 2D math: arcGeometry, vec2, elementHitTest, dimensionLayout, coordinateSystem
  (screen-space math → move UP to frontend/viewport: ScreenPoint, ScreenRect,
   dimensionHandleHitTest, ConstraintIconPlacement, sketchBoxSelection)
```
Do in two commits: (3a) carve sketch/ + geometry2d/ out of engine/; (3b) rename engine/→solid/.

- 3a ✅ DONE: extracted src/cad/sketch/ (solver + 2D geometry + selection math + drawTools + SketchSolver).
  Decision: did NOT create a separate geometry2d/ — the pure-2D helpers live alongside the solver in
  cad/sketch/ (they're the sketch domain; keeping them together is simpler and they share types).
  Decision: did NOT move screen-space math up to viewport — ScreenPoint/ScreenRect/sketchBoxSelection/
  constraintAnchors are pure, testable sketch-domain math and stay in cad/sketch/. (Optional future move.)
  externalGeometry.ts(+test) stays in cad/engine/ (OCC-bound). One OCC ref remains: cad/engine imports
  @/cad/sketch/coordinateSystem from sketchBuilders.ts + externalGeometry.ts (solid depends on sketch data — OK direction).
- 3b: rename engine/→solid/ (per-file git mv due to vite lock), replace @/cad/engine -> @/cad/solid,
  update CLAUDE.md. externalGeometry moves with engine into solid/sketch/ (it's the OCC bridge — fine).
- Consider pulling constraint pipeline out of CADLayout.tsx into cad/sketch/ (CLAUDE.md debt item).
- Verify: build + test + browser (per CLAUDE.md 3D-change rule).

## Commit strategy
Separate commit per step (1, 2, 3a, 3b). Commit directly to main (per user pref).

## Notes / decisions
- ALL THREE STEPS COMPLETE. build + 615 tests green after each.
- One pre-existing flaky test: SketchRenderer.test.tsx "highlights the dimension … while dragging"
  fails ~intermittently under full-suite run (viewport-store state leak between tests), passes in
  isolation. NOT caused by this refactor (pure path renames). Candidate follow-up: reset
  useViewportStore in that file's afterEach.
- Optional future work (not done, low priority):
  * Move sketch-space screen math (ScreenPoint/ScreenRect/sketchBoxSelection/constraintAnchors) up to
    frontend/viewport/ if we want cad/ to be render-agnostic. Kept in cad/sketch/ (pure + testable).
  * Pull constraint-solver pipeline out of CADLayout.tsx into cad/sketch/ (CLAUDE.md debt item — still open).
  * externalGeometry.ts is the lone OCC↔sketch bridge; lives in cad/solid/sketch/.
