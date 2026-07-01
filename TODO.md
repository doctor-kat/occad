# TODO — Selector system (ROADMAP §9.1)

Port CadQuery's **selector** concept — declarative rules that pick edges/faces/vertices by
geometry (`>Z`, `|Z`, `%plane`, `>>Z[1]`, nearest-to-point, radius-nth, and boolean combinations)
— onto our existing TS-over-OCCT engine. Goal: replace tedious one-edge-at-a-time picking for
fillet/chamfer/shell with a rule you type once that re-anchors across rebuilds.

> **License:** clean-room port of the *concepts and grammar* documented in CadQuery's
> `selectors.py`, **not** a copy of its code. CadQuery is Apache-2.0 (reference only). Do not paste
> source; reimplement from the semantics table below.

## Why this fits our codebase (context)

- `fingerprint.ts` already extracts, per sub-shape: **geomType** (plane/cylinder/cone/sphere/torus/
  bspline for faces; line/circle/ellipse/bspline for edges), **measure** (area/length), **centroid**
  (center of mass), and **OBB half-sizes**. A selector engine is mostly a *filter + rank* pass over
  that same descriptor data — so it stays **pure and mockable** exactly like `fingerprint.ts`.
- The **one missing datum** is orientation/**direction**: face normal at its center, and edge tangent
  direction. Directional selectors (`>Z`, `|Z`, `#Z`) need it; the current fingerprint deliberately
  omits it (OBB is rotation-invariant by design). We add it to a richer *worker-only* descriptor, not
  to the persisted `Fingerprint`.
- Selectors resolve to **indices → `StableRef[]`** (fingerprinted), so a materialized selection is
  automatically deterministic-topology stable via the machinery in `modifications.ts` /
  `fingerprint.ts`. Nothing new needed for stability.
- Plugs into the existing selection→params flow: fillet/chamfer read `params.edges: GeometryRef[]`,
  shell/offset read `params.faces`. The selector just *produces* those arrays (Phase A) or is stored
  and *re-evaluated each rebuild* (Phase B).

## Selector grammar & semantics (target)

String DSL, whitespace-separated tokens combined left→right; parentheses + `and`/`or`/`not`/`exc`
for composition. Axis ∈ {X, Y, Z} (optionally signed, e.g. `+Z`, `-Z`). Kind is implied by the
call site (edges for fillet/chamfer, faces for shell) but a leading `%kind` may pin it.

| Token            | Meaning (CadQuery parity)                                                        | Needs      |
|------------------|----------------------------------------------------------------------------------|------------|
| `>Z` / `<Z`      | Sub-shape whose **center** is max/min along axis (DirectionMinMax)               | centroid   |
| `>Z[n]` / `<Z[n]`| n-th from the max/min along axis, 0-based, ties grouped (DirectionNth)           | centroid   |
| `\|Z`            | **Parallel** to axis — edges tangent ∥ Z; faces whose **normal** ∥ Z            | direction  |
| `#Z`             | **Perpendicular** to axis — normal/tangent ⊥ Z                                   | direction  |
| `+Z` / `-Z`      | Direction ∥ **and** pointing the same/opposite way as +Z                         | direction  |
| `%plane` `%line` `%circle` `%cylinder` …| Geometry **type** filter                                          | geomType   |
| `>>Z` (alias)    | (optional) same as `>Z`; keep `>` canonical                                       | centroid   |
| `radius(n)` / `>>R[n]` | n-th smallest/largest **radius** (cylinders/circles) — RadiusNth            | +radius    |
| `near(x,y,z)`    | Nearest sub-shape to a point (NearestToPoint)                                     | centroid   |
| `A and B` / `A B`| Intersection                                                                     | —          |
| `A or B`         | Union                                                                            | —          |
| `not A` / `exc A`| Complement / set-subtract                                                         | —          |

**Semantics to get exactly right** (verify against `selectors.py` before coding each):
- `>Z` on **faces** = the face(s) whose center has max Z (e.g. the top of a box). `|Z` on faces =
  faces whose **normal** is parallel to Z (top **and** bottom — the horizontal faces).
- `#Z` on faces = faces whose normal ⊥ Z (the 4 vertical walls of a box).
- `|Z` on **edges** = edges whose direction is parallel to Z (the 4 vertical edges of a box) — this
  is the flagship "fillet all vertical edges" case.
- Ties: min/max group sub-shapes within a tolerance so `>Z` can return *all* co-planar top faces.

## Data model additions

- `SubShapeDescriptor` (worker-only, **not persisted**): `{ index, kind, geomType, measure,
  centroid, obb, direction?: {x,y,z}, radius?: number }`. Reuse `fingerprint.ts` extraction; add
  `direction` (face normal / edge tangent) + `radius` (from `BRepAdaptor_Surface.Cylinder().Radius()`
  / `Curve.Circle().Radius()`).
- Keep `Fingerprint` untouched (persisted/serialized — don't add direction there).

## Work breakdown (TDD, pure-first — mirror fingerprint.ts discipline)

### Phase 0 — Descriptor extraction (worker, thin)  ❌
- [ ] `describeSubShapes(ctx, shape, kind): SubShapeDescriptor[]` in a new
      `src/cad/engine/selectors/describe.ts`. Reuse `fingerprint.ts` helpers for geomType/measure/
      centroid/obb; add **face normal** (planar: plane axis; else surface `D1` at UV-center → normal)
      and **edge tangent** (`BRepAdaptor_Curve.D1` at mid-param; line = its direction) + optional
      **radius**. All via `ctx.oc` so it's mockable.
- [ ] `describe.test.ts` with a mock `oc` (box: 6 planar faces w/ axis-aligned normals, 12 edges).

### Phase 1 — Pure selector engine (NO WASM — the core, biggest test surface)  ✅
- [x] `src/cad/engine/selectors/types.ts` — `SubShapeDescriptor` + `SelectorNode` AST + `Axis`/`Vec3`.
- [x] `src/cad/engine/selectors/grammar.ts` — `tokenize` + recursive-descent `parse` → AST
      (type/direction/minmax/nth/radius/near + and/or/not; `exc`=unary complement). **`grammar.test.ts`**
      (14): every token, `>>` alias, `[n]`, juxtaposition=AND, AND-binds-tighter-than-OR, parens,
      case-insensitivity, and error cases (empty/unknown token/unbalanced parens).
- [x] `src/cad/engine/selectors/evaluate.ts` — `evaluate(ast, descriptors, opts?): number[]`, pure.
      All predicates ported; tunable angle/coord/radius tolerances. **`evaluate.test.ts`** (14):
      `>Z`→top face, `<Z`→bottom, `|Z`(faces)→2 horizontals, `#Z`(faces)→4 walls, `±Z`→outward
      top/bottom, `|Z`(edges)→**4 vertical edges** (flagship), `%plane`, tie-grouping, `>Z[n]`,
      `radius(n)`, `near()`, and `and`/`or`/`not` composition.
- [x] `src/cad/engine/selectors/index.ts` — `selectSubShapes(descriptors, selector, opts?)` (parse+
      evaluate) + re-exports. **28/28 tests green; `bun run build` clean.**
- [ ] Follow-up polish (deferred): friendly "no matches" error vs. empty array; binary set-subtract
      (`A exc B`) — currently `exc` is unary only (use `A and not B`).

### Phase 2 — Worker wiring: materialize a selector → StableRef[]  ❌
- [ ] `ResolveSelectorRequest` / `SelectorResolvedResponse` DTOs in `src/worker/types/{requests,
      responses}/` + index barrels + union types (`WorkerRequestType`/`WorkerResponseType`).
- [ ] Handler `handleResolveSelector(ctx, { shapeId, kind, selector })` in `operations.ts`:
      `describeSubShapes` → `selectSubShapes` → for each hit index, `computeFingerprint` →
      **`StableRef[]`** (fingerprinted, so stable) → post back. Reuse `findSketchShape`/current-body
      lookup already in `operations.ts`.
- [ ] `useOpenCascade.resolveSelector(shapeId, kind, selector)` bridge method + promise/callback
      plumbing mirroring `getFaceGeometry`.
- [ ] Unit test the handler path with mock `oc` (assert it returns fingerprinted refs, not bare
      indices); geometric correctness is e2e.

### Phase 3 — UI: "select by rule" for fillet/chamfer/shell  ❌
- [ ] In `OperationPanel` (modification params), add a selector `TextInput` beside the manual
      edge/face list: typing a rule calls `resolveSelector` and **fills** `params.edges`/`.faces`
      with the returned `StableRef[]` (Phase A = materialize-once). Show match count + a "couldn't
      match" state. Highlight resolved sub-shapes in the viewport (reuse hover/selection highlight).
- [ ] A few **preset chips** for the common cases (`|Z` all vertical edges, `>Z` top face,
      `#Z` side faces) so it's discoverable without learning the DSL.
- [ ] Tests: `OperationPanel.test.tsx` (rule input fills refs, empty-match state).

### Phase 4 — (stretch) Persistent parametric selectors  ❌ — Phase B
- [ ] Optional `selector?: string` on `FilletParams`/`ChamferParams`/`ShellParams`. When present,
      `resolveSubShapes` (or a pre-step in `handleRebuild`) **re-evaluates** it against the live body
      each rebuild instead of using stored indices — so "fillet all vertical edges" auto-includes
      edges introduced by an upstream change. Decide precedence when both `selector` and explicit
      `edges` exist (selector ∪ explicit, or selector wins).
- [ ] e2e: box → fillet `|Z` → edit box to add a boss that creates new vertical edges → rebuild →
      the new edges are filleted too (proves live re-evaluation).

### Phase 5 — e2e + docs  ❌
- [ ] `e2e/selectors.spec.ts`: box → fillet via `|Z` selects 4 vertical edges → valid rounded solid;
      `>Z` top-face shell; `%cylinder` on a cylinder.
- [ ] Flip ROADMAP §9.1 status → ✅ (or 🟡 if Phase 4 deferred); update the footer date.

## Test / verify checklist (per CLAUDE.md: 3D changes require tests)
- `bun run test` green (grammar/evaluate/describe unit suites).
- `bun run build` (type errors).
- e2e selectors spec.
- ⚠️ Unit tests mock `oc` — **real geometric validity (normals, tangents, radii) is e2e-only.** Load
  the app / run e2e before trusting Phase 0 extraction (the CLAUDE.md OCC-constructor-name gotcha).

## Open questions
- Materialize-once (Phase A) vs persistent re-evaluation (Phase B) as the default UX? Start A.
- Edge selector default axis frame: world axes only, or also relative to a picked face's plane
  (CadQuery workplane-relative selectors)? Start world-only.
- Grammar surface: full CadQuery string parity vs a trimmed subset + preset chips? Ship the subset
  (`>`, `<`, `|`, `#`, `%`, `[n]`, `and`/`or`/`not`) first; radius/near are Phase-1 stretch.

---
_Started 2026-06-30. Phase order is deliberately pure-first: Phases 0–1 need no WASM and carry the
bulk of the logic + tests, matching the `fingerprint.ts` mockable-engine pattern._
