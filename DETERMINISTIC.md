# DETERMINISTIC.md — Stable & Deterministic Topology (living doc)

> **Purpose.** Track the effort to make faces, edges, and sketch entities *stable*
> and *deterministic* across the feature tree, parametric rebuild, and (eventually)
> undo/redo. This is the classic CAD **topological-naming problem**. This file is the
> single source of truth for the plan, decisions, and progress — keep it current so
> anyone can take over mid-stream.

Last updated: 2026-06-23

---

## TL;DR of the problem

Every face/edge selection in the app is stored as a **positional ordinal index**
(`face-N` / `edge-N`) into an OpenCascade `TopTools_IndexedMapOfShape`. Those indices
are produced by `tessellation.ts` / `handleGetFaceGeometry` and resolved by
`resolveSubShapes` (`modifications.ts`) and `findShapeByTag` (`externalGeometry.ts`).

- **Within an unchanged topology:** consistent and deterministic. The UI index space
  and the worker resolution space both use `MapShapes_1`, so a click resolves to the
  same sub-shape. ✅
- **Across any topology-changing edit (booleans, upstream edits, reorder, suppress):**
  indices renumber. A stored `edge-7` can silently point at a *different* edge or an
  out-of-range one. OCC guarantees nothing about ordinal ordering across booleans, and
  `handleRebuild` rebuilds the whole body through `Fuse`/`Cut`/`Common` every time. ❌

There is **no undo/redo** system (the Toolbar buttons are non-functional stubs), but all
authoritative state lives in the serializable `CADProject`, so snapshot undo/redo is
cheap to add *once selections are stable*.

---

## What OCC gives us (verified bound in `opencascade.full`)

This WASM build exposes the entire persistent-naming toolkit. Probed in
`node_modules/opencascade.js/dist/opencascade.full.d.ts`:

| Tier | Facility | Bound? | Use |
|------|----------|--------|-----|
| **1. History** | `Modified(S)`/`Generated(S)`/`IsDeleted(S)` on every `BRepBuilderAPI_MakeShape`; `BRepAlgoAPI_*` `SetToFillHistory`/`History()`; `BRepTools_History` (`Merge_1/2`, `AddModified`, …) | ✅ | Exact propagation of IDs through booleans/fillet/chamfer |
| **2. Fingerprint** | `BRepGProp.SurfaceProperties_1`/`VolumeProperties_1`/`LinearProperties` + `GProp_GProps` (`Mass`, `CentreOfMass`); `Bnd_OBB` + `BRepBndLib.AddOBB`; `BRepAdaptor_Surface` (surface type); `TopoDS_Shape.IsSame`/`IsPartner`/`HashCode` | ✅ | Geometry-anchored matching for selection-at-rest + fallback |
| **3. OCAF/TNaming** | `TNaming_Builder`/`Selector`/`NamedShape`, full `TDF_*`/`TDataStd_*`/`TDocStd_Document` | ✅ | The "correct" heavy solution — **deliberately NOT used** (see Decisions) |

### Decision: hybrid Tier 1 + Tier 2, not Tier 3

Full TNaming/OCAF is the theoretically-right answer but a large architectural commitment
(restructure the worker around a `TDocStd_Document`, drive every op through
`TNaming_Builder`, resolve via `TNaming_Selector::Solve`). Overkill for this app's op set
and hard to debug across the WASM boundary. **Hybrid model instead:**

1. Assign a persistent stable ID to each sub-shape at creation; store
   `stableId → fingerprint` in the serialized `CADProject`.
2. Propagate IDs through each operation via `History().Modified()/Generated()/IsRemoved()`.
3. Re-anchor by fingerprint (surface type + area + OBB) at selection time and as a
   fallback when history is unavailable.
4. Replace `edge-N`/`face-N` everywhere with stable IDs.

---

## Plan / progress

### ✅ Step 1 — Deterministic ordering & loud failures  *(DONE)*

Prerequisite: the rebuild order itself must be deterministic, or stable IDs are moot.

- **Shared total order.** New `src/cad/types/project/buildOrder.ts`: `orderKey` =
  `sequence ?? createdAt`; `compareBuildOrder` tie-breaks by `id`. Used by **both** the
  worker rebuild (`operations.ts handleRebuild`) and the feature tree
  (`useCADState.ts featureTree`). Kills same-millisecond `Array.sort` nondeterminism.
- **`reorderFeature` actually works.** It previously reordered the `features` array,
  which both layers ignored (they sort by key). Now it assigns the moved feature an
  explicit `sequence` slotted between its new neighbours' keys, with a guard that keeps a
  feature strictly after its consumed sketch (`REORDER_EPSILON`). Added `sequence?: number`
  to `Feature` and `Sketch`.
- **No more silent stale selections.** `resolveSubShapes` now returns
  `{ shapes, unresolved }`; `applyFillet`/`applyChamfer`/`applyShell` throw a descriptive
  error naming the unresolved refs instead of quietly filleting the wrong/fewer edges.
  `handleRebuild` posts a per-item `error` (with `featureId`) so the failure surfaces on
  the tree item (`itemErrors`, cleared before each rebuild in `CADLayout`).

**Tests added:**
- `src/cad/types/project/buildOrder.test.ts` — orderKey, tie determinism, total-order
  independence from input permutation, sequence-jumps.
- `src/cad/engine/modifications.test.ts` — `resolveSubShapes` reports `unresolved`;
  fillet/chamfer/shell throw loudly & do no partial work on a stale ref.
- `src/frontend/shared/useCADState.test.ts` — reorder reflected in tree **and**
  `compareBuildOrder`; version bump; never-before-its-sketch invariant.

Full suite green (135 → 150 tests) + `bun run build` clean.

> ⚠️ Known limitation still open after step 1: an *in-range but shifted* index still
> binds to the wrong sub-shape silently — only **out-of-range/malformed** refs are caught.
> Detecting the wrong-edge case needs fingerprints (step 2).

### ✅ Step 2 — `fingerprint.ts` engine + resolution  *(DONE — scaffold)*

New worker module `src/cad/engine/fingerprint.ts` (pure, `ctx.oc`-injected so it is
unit-tested without WASM):

- `computeFingerprint` / `fingerprintAll` — per face/edge fingerprint
  `{ kind, index, geomType, measure (GProp Mass), centroid (CentreOfMass), obb (Bnd_OBB
  half-sizes, sorted) }`. Uses `BRepGProp.SurfaceProperties_1`/`LinearProperties`,
  `BRepBndLib.AddOBB`, `BRepAdaptor_Surface_2`/`Curve_2.GetType()`.
- `fingerprintScore` — dimensionless dissimilarity; different kind/geomType ⇒ `Infinity`;
  centroid distance (normalized by characteristic length) + relative measure diff + OBB
  signature diff.
- `matchFingerprint` — best candidate with `confident` / `ambiguous` flags
  (`ACCEPT_THRESHOLD`, `AMBIGUITY_MARGIN`); refuses to pick between near-identical faces.
- `resolveStableRef(ctx, shape, { kind, index, fingerprint? })` — returns the live
  0-based index, preferring a confident fingerprint match and falling back to the stored
  ordinal index (or -1 = stale).

**Tests:** `src/cad/engine/fingerprint.test.ts` (15) — determinism, OBB axis-order
invariance, edge length/curve-type path, score type-guard/monotonicity, ambiguity,
absent-geometry, and the **money test**: `resolveStableRef` re-finds a selection after an
edit renumbers the index map, where the bare ordinal index silently binds to the wrong
face.

> This is the **engine scaffold**. It is not yet wired into the live worker — selection
> storage still uses `edge-N` strings (see step 3). The engine-level proof that the
> approach resolves the naming bug is in `fingerprint.test.ts`.

### ✅ Step 3a — Resolution side wired (worker), backward compatible  *(DONE)*

- Lifted the serializable ref types into `src/cad/types/geometry/Fingerprint.ts`:
  `Fingerprint`, `StableRef`, `GeometryRef = string | StableRef`, plus `toStableRef` /
  `parseRefString` / `refLabel` / `hasFingerprint`. `fingerprint.ts` now imports & re-exports
  these (canonical definitions live in types).
- `FilletParams.edges`, `ChamferParams.edges`, `ShellParams.faces`, `OffsetParams.faces`
  are now `GeometryRef[]` — a bare `edge-N` string OR a fingerprinted `StableRef`. Persisted
  projects (bare strings) keep working with **no migration**.
- `resolveSubShapes` is fingerprint-aware: a ref with a fingerprint is re-found by geometry
  (survives index renumber) and only falls back to its stored ordinal index; a bare index
  resolves positionally as before. The body is fingerprinted **lazily** — only when some ref
  carries a fingerprint — so the index-only path stays cheap. Unmatched refs still surface
  loudly via `unresolved` (step 1).
- `fingerprint.ts` gained `resolveAgainst(live, ref)` (resolve against precomputed
  fingerprints) so the body is fingerprinted once per `resolveSubShapes` call.
- `OperationPanel` coerces `GeometryRef[]` → `edge-N`/`face-N` labels when populating the
  edit form.

**Tests:** `modifications.test.ts` +7 — re-find after renumber, fingerprint-beats-stale-index,
bare-index-binds-wrong contrast, unmatched→unresolved, mixed bare+stable, applyFillet
end-to-end through a renumber, determinism. All existing string-ref tests unchanged & green.

### 🔜 Step 3b — Capture (lazy fingerprint write-back)  *(NEXT)*

The UI still stores bare `edge-N` strings (no OCC on the main thread). Capture lazily in
the worker instead of via a selection round-trip:

- During `handleRebuild`, after resolving a modification's refs against the body it acts on,
  fingerprint the resolved sub-shapes and post the upgraded `GeometryRef[]` back.
- Frontend persists the enriched params **without bumping `version`** (a new no-rebuild
  updater) so there's no rebuild loop.
- Net effect: first successful build of a fillet/chamfer/shell (when the index is still
  valid) captures the fingerprint; every later rebuild resolves by geometry.

### 🔜 Step 3c — History propagation (exactness)

- `SetToFillHistory(true)` on every boolean; carry stable IDs across `handleRebuild` via
  `BRepTools_History.Merge` so IDs survive upstream edits exactly (fingerprint becomes the
  fallback, not the primary). Also covers sketch external-geometry (`findShapeByTag`).

### 🔜 Step 4 — Snapshot undo/redo

- Push `CADProject` snapshots on each mutation; wire the stub Toolbar buttons. Cheap
  given the fully-serializable state — do it after steps 2–3 so restored selections
  resolve correctly.

---

## Key files

| Concern | File |
|---|---|
| Shared build order | `src/cad/types/project/buildOrder.ts` (+ `.test.ts`) |
| Worker rebuild order / per-item errors | `src/cad/engine/operations.ts` (`handleRebuild`) |
| Selection resolution (modifications) | `src/cad/engine/modifications.ts` (`resolveSubShapes`) |
| Selection resolution (sketch external geom) | `src/cad/engine/sketch/externalGeometry.ts` (`findShapeByTag`) |
| Index production | `src/cad/engine/tessellation.ts`, `operations.ts` (`handleGetFaceGeometry`) |
| Tree + reorder | `src/frontend/shared/useCADState.ts` (`featureTree`, `reorderFeature`) |
| Fingerprints | `src/cad/engine/fingerprint.ts` *(step 2, not yet created)* |

## Gotchas for whoever takes over

- `useOpenCascade` is instantiated **once** in `CADLayout` — do not add a second call
  (separate worker = isolated shape storage).
- Unit tests mock OCC (`mockCtx`); real geometric validity is e2e only. Fingerprint logic
  must be testable against the mock (keep it pure / inject `oc`).
- `reorderFeature` is **not yet wired to any UI** — fixing its determinism is low-risk,
  but if/when a drag handler is added, `newIndex` is an index into the *ordered features*
  list (consumed sketches are tree children, not separate slots).
- The worker's single interleaved sketch+feature pass is intentional: external-geometry
  sketches re-project against the `currentBody` that exists at their point in the order.
  Do **not** naively split into "all sketches then all features" — it breaks projection.
