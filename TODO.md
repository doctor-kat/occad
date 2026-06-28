# TODO — Sketch Constraints Implementation

Living context doc for implementing **sketch constraints** end-to-end (TDD, e2e per feature).
See `ROADMAP.md` §1.2 for the audited gap list.

## ✅ FEATURE COMPLETE (2026-06-23)

All 10 standard constraints work end-to-end (factory + real-solver test + UI + e2e):
horizontal, vertical, parallel, perpendicular, equal, angle, coincident, distance, radius, tangent.
Plus: create toolbar (`SketchConstraintToolbar`), list + delete (`SketchConstraintList`), whole-element AND
point-level (endpoint) selection, the circle `c_id` + OCC `MakeEdge` overload fixes (radius solves 10→40, circles
extrudable), and orphaned `types/sketch/constraints/*` removed.
Tests: 83 unit (incl. 12 real-solver factory tests), 11 constraint e2e — all green; existing sketch e2e unaffected.
**Deferred:** Midpoint & Symmetric (no single planegcs primitive — need multi-constraint composition); arc/ellipse
solve (need `start_id`/`end_id` point primitives reshape).

## Architecture facts (discovered — don't re-derive)

- **Pipeline:** user draws → `sketch.elements` (`SketchElement[]`) → `mapElementsToPrimitives()` in
  `src/frontend/ui/CADLayout.tsx` → planegcs `sketch.primitives` → `solver.solve()` (`SketchSolver.ts`, called from
  `operations.ts:handleBuildSketch` and rebuild) → `buildSketchWire()` builds the OCC wire **from `primitives`**.
- **The solver is real and already wired.** `sketch.constraints: any[]` holds **planegcs-format** constraint objects.
  The only missing piece for constraints is *creating* them (no `addConstraint`, no UI).
- **planegcs runs in vitest/node** — confirmed it actually solves (distance moved a point 5→20). So solver-behavior
  tests are **real unit tests**, not mocks. New tests should NOT mock planegcs.
- **Primitive id derivation** (from `mapElementsToPrimitives`): line `el.id` (+ points `${el.id}_p1/_p2`); circle
  `el.id` (+ center `${el.id}_center`); rect lines `${el.id}_l1..l4` (+ points `_p1.._p4`); polygon `${el.id}_l{i}`.
- **Selection:** `SketchOverlay.tsx` has `selectedElementIds: Set<string>` (element-level). Point-level (endpoint)
  selection does NOT exist yet — needed for coincident/distance-between-points.
- **Typed interfaces** in `src/cad/types/sketch/constraints/*.ts` are orphaned (only their own tests import them).
  New canonical model = planegcs objects produced by `constraintFactory`.

## planegcs constraint strings (verified in `@salusoft89/planegcs/planegcs_dist/constraints.ts`)

| Semantic        | planegcs type        | params                          |
|-----------------|----------------------|---------------------------------|
| Horizontal      | `horizontal_l`       | `l_id`                          |
| Vertical        | `vertical_l`         | `l_id`                          |
| Coincident      | `p2p_coincident`     | `p1_id, p2_id`                  |
| Parallel        | `parallel`           | `l1_id, l2_id`                  |
| Perpendicular   | `perpendicular_ll`   | `l1_id, l2_id`                  |
| Distance        | `p2p_distance`       | `p1_id, p2_id, distance`        |
| Radius (circle) | `circle_radius`      | `c_id, radius`                  |
| Radius (arc)    | `arc_radius`         | `a_id, radius`                  |
| Equal length    | `equal_length`       | `l1_id, l2_id`                  |
| Tangent (LC)    | `tangent_lc`         | `l_id, c_id`                    |
| Angle (lines)   | `l2l_angle_ll`       | `l1_id, l2_id, angle`           |
| Midpoint        | `midpoint_on_line_ll`| `l1_id, l2_id`                  |
| Fixed           | (no constraint)      | set `primitive.fixed = true`    |

Dimensional constraints (`distance`, `*_radius`, `*_angle`) take `driving?: boolean` (default true = driving).

## Plan (each constraint "feature" = engine + state + UI + **e2e**)

### Phase 0 — Foundation & known bug ✅
- [x] Confirm planegcs solves in vitest (probe passed).
- [x] **Bug fixed:** extracted `mapElementsToPrimitives` → `src/cad/engine/sketch/elementsToPrimitives.ts`, fixed the
  undefined `p3_id`/`p4_id` rect typo, added `elementsToPrimitives.test.ts` (4 tests incl. rect regression). CADLayout
  now imports the shared fn.

### Phase 1 — Engine: constraint factory (TDD, real solver) ✅
- [x] `src/cad/engine/sketch/constraintFactory.ts`: `createConstraint(id, input)` → planegcs object; `CONSTRAINT_ARITY`.
- [x] `constraintFactory.test.ts`: shape tests + **real-solver** tests (12 total) proving geometry actually moves for
  horizontal, vertical, coincident, parallel, perpendicular, distance, radius, equal, tangent, angle. All green.

### Circle field-name mismatch — FIXED (✅), but exposed a deeper OCC bug
- [x] `elementsToPrimitives` now emits `c_id` for circles; readers (`sketchBuilders.translatePrimitivesToOCC`,
  `SketchRenderer`) accept `c_id ?? center_id`. Circles reach the solver; radius/tangent solve (unit-tested).
  Tests: `elementsToPrimitives.test.ts` (c_id), `sketchBuilders.test.ts` (c_id + legacy center_id fallback).
- [ ] **Arc/ellipse**: still emit `center_id` (readers fall back). Arcs additionally need `start_id`/`end_id` *point*
  primitives (planegcs `push_arc` reads them) before they can solve — larger reshape.
- [x] ✅ **OCC circle `BindingError` FIXED.** Root cause: wrong OCC overloads — `BRepBuilderAPI_MakeEdge_10` needs
  `(gp_Circ, gp_Pnt, gp_Pnt)` and `_11` needs vertices. Full circle = `MakeEdge_8(gp_Circ)`, arc by angles =
  `MakeEdge_9(gp_Circ, p1, p2)`. Circles now build wires + solve end-to-end (radius e2e asserts 10→40). Unblocks
  circle extrude too.

### Phase 2 — State: useCADState ✅
- [x] `addConstraint(sketchId, constraint)`, `removeConstraint(sketchId, constraintId)` + unit tests (3, green).
- [x] Both bump `project.version` so a rebuild re-solves.

### Phase 3 — UI + e2e ✅ (line constraints) / 🟡 (rest)
- [x] Lifted sketch element selection into `viewportStore` (`selectedSketchElementIds` + toggle/set/clear);
  `SketchOverlay` now reads/writes it (multi-select via toggle on click).
- [x] `SketchConstraintToolbar` (sketch-mode overlay): Horizontal/Vertical (1 line), Parallel/Perpendicular/Equal
  (2 lines), enabled by selection; shows `Solver Constraints: N` + `DOF: N`. Wired in `CADLayout.handleApplyConstraint`
  → `createConstraint` → `addConstraint` → `buildSketch` (re-solve).
- [x] `e2e/constraints-line.spec.ts`: 5 parametrized cases (h/v/parallel/perp/equal), all green. Seeds a sketch and
  drives selection via the store-exposed `window.__viewportStore` (canvas draw/select is non-deterministic in the
  perspective view — see notes). Asserts toolbar count, DOF populated, and the persisted planegcs object.
- [x] **Point-level (endpoint) selection** — `SketchOverlay` renders clickable point handles; coincident/distance use them.
- [x] Dimensional value entry — `NumberInput` in the toolbar (radius/distance = length, angle = degrees).
- [x] Constraint list panel with per-constraint delete (`SketchConstraintList` → `removeConstraint`).
- [x] All 10 kinds in the toolbar (added tangent/angle/coincident/distance); compact icon layout.

**e2e notes / follow-ups:**
- Entering sketch mode does NOT orient the camera normal to the plane → the grid is tilted/offset, so deterministic
  canvas clicking for draw+select is impractical. A "look normal to sketch" action would unblock pure-UI draw/select
  e2e and is a real UX win.
- `buildSketchWire` fails (`BRepBuilderAPI_MakeWire`) when connected line elements use **distinct** endpoint point-ids
  at the same coords; the rectangle path works because its edges share point-ids. The seed shares the corner id.

### Phase 4 — New constraint types & cleanup
- [ ] Model Midpoint, Symmetric (planegcs `symmetric`), Angle, Equal end-to-end.
- [ ] Remove/replace orphaned `types/sketch/constraints/*.ts` (or back them with the factory).
- [ ] Add `TangentConstraint` parity; reconcile `SketchConstraintType` enum.
- [ ] Update `ROADMAP.md` §1.2 as items land.

### Phase 5 — Auto-constraints on draw (SolidWorks "sketch relations")
- [x] **Rectangle** → 2 Horizontal (top/bottom) + 2 Vertical (sides). `inferAutoConstraints(elements)`
  (`src/cad/engine/sketch/autoConstraints.ts`), regenerated every edit in `CADLayout.handleUpdateSketch`
  (deterministic ids → idempotent; tagged `auto: true`; merged with the user's manual constraints). Corners
  are coincident by construction (shared point ids), so no explicit coincident emitted. Covers corner **and**
  center rectangle (both map to `RECTANGLE`). Tests: `autoConstraints.test.ts` (4, incl. real-solver skew→axis-
  aligned) + `e2e/auto-constraints.spec.ts` (1, persists 4 relations).
- [ ] Extend to line (endpoint coincident-on-snap; near-axis → H/V), 3-pt rectangle & parallelogram
  (perpendicular/parallel), center rectangle symmetry/midpoint.
- [ ] Surface auto-constraints distinctly in `SketchConstraintList` (badge), and decide delete semantics
  (currently a deleted auto-constraint regenerates on the element's next edit).

## Progress log
- 2026-06-23: Audited gaps, wrote this plan. Confirmed planegcs solves in vitest.
- 2026-06-23: Phase 0 + Phase 1 complete. Extracted+fixed `elementsToPrimitives` (rect bug), built
  `constraintFactory` with 12 real-solver TDD tests (all constraint kinds proven). Found circle/arc `c_id` vs
  `center_id` mismatch (tracked above). Full suite 86→ green; build green.
- 2026-06-23: Phase 2 + Phase 3 (line constraints) complete. `addConstraint`/`removeConstraint` in `useCADState`
  (+3 unit tests). Lifted sketch selection into `viewportStore`. New `SketchConstraintToolbar` for
  horizontal/vertical/parallel/perpendicular/equal. `e2e/constraints-line.spec.ts` — 5 cases green. Unit suite 89 green,
  build green.
- 2026-06-23: Circle `c_id` fix + Radius UI. `elementsToPrimitives` emits `c_id`; readers accept both keys
  (+2 sketchBuilders tests). Added Radius button + value `NumberInput` to the toolbar. Surfaced a pre-existing OCC
  circle `BindingError`.
- 2026-06-23: **Feature completed.** Fixed the OCC overloads (`BRepBuilderAPI_MakeEdge_8` circle / `_9` arc) — radius now
  solves end-to-end (e2e asserts 10→40). Added Tangent + Angle + Coincident + Distance to the toolbar; point-level
  endpoint selection in `SketchOverlay`; `SketchConstraintList` (delete). Fixed selection being wiped on remount (only
  clear when entering a draw tool). Compacted toolbar to icon buttons (fixed off-screen overflow flakiness). Removed
  orphaned `types/sketch/constraints/*` + enum. `constraints-advanced.spec.ts` (tangent/angle/coincident/distance +
  delete). 83 unit + 11 constraint e2e green; build green; existing sketch e2e unaffected.
- 2026-06-27: **Phase 5 started — rectangle auto-constraints.** `inferAutoConstraints` emits 2 H + 2 V per
  `RECTANGLE` (corner + center rectangle); regenerated each edit in `CADLayout.handleUpdateSketch` (deterministic ids,
  `auto: true`, merged with manual). `autoConstraints.test.ts` (4, incl. real-solver skew→axis-aligned) +
  `e2e/auto-constraints.spec.ts`. Full suite 347 unit green; build green. Shipped alongside sketch box/crossing
  select + sidebar entity list (ROADMAP §6b/§7).
