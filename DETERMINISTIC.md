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

### 🔜 Step 2 — `fingerprint.ts` + stable IDs  *(IN PROGRESS / NEXT)*

- New worker module `src/cad/engine/fingerprint.ts`: compute a stable geometric
  fingerprint per face/edge — `{ surfaceType, area|length (GProp Mass), obb(center,axes,halfsizes), centroid }`.
- Stable-ID allocator + `stableId ↔ live sub-shape` resolution by fingerprint (nearest
  OBB center + matching type + area within tolerance), falling back to ordinal index.
- Switch selection storage (`FilletParams.edges`, `ChamferParams.edges`,
  `ShellParams.faces`, sketch `planeRef`, external-geometry `sourceId`) from raw indices
  to stable IDs. Keep back-compat migration for persisted `edge-N` projects.
- Thorough tests: fingerprint stability under re-tessellation; resolution survives an
  upstream edit that renumbers indices; ambiguous-match handling.

### 🔜 Step 3 — History propagation through rebuild

- `SetToFillHistory(true)` on every boolean; carry stable IDs across `handleRebuild` via
  `BRepTools_History.Merge`. Makes IDs survive upstream edits exactly (not just by
  fingerprint guess).

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
