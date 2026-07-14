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

### Step 2 — `frontend/canvas/` → `frontend/viewport/`  (STATUS: not started)
- `git mv src/frontend/canvas src/frontend/viewport`
- Update all `@/frontend/canvas` imports → `@/frontend/viewport`.
- Update CLAUDE.md architecture section.
- Verify: build + test.

### Step 3 — split `src/cad/engine/`  (STATUS: not started)
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
- Consider pulling constraint pipeline out of CADLayout.tsx into cad/sketch/ (CLAUDE.md debt item).
- Verify: build + test + browser (per CLAUDE.md 3D-change rule).

## Commit strategy
Separate commit per step (1, 2, 3a, 3b). Commit directly to main (per user pref).

## Notes / decisions
- (none yet)
