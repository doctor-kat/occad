# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Update the Status Summary / Open Items Sections After Any Work

After completing any work in this repository, update the "Status summary" and "Open items" sections of this file (below) to reflect the change (mark items done, add new follow-ups, adjust status). Do this before considering the task complete. This file tracks *status*, not history — the detailed fix-by-fix narrative lives in git commit messages, not in this doc.

## Project Overview

Parametric 3D CAD modeling application built with React, TypeScript, and OpenCascade.js. Browser-based CAD environment (like SolidWorks/Fusion 360) with sketching, extrusion, and parametric feature history.

## Development Commands

```bash
# Package manager: Bun (not npm)
bun install

# Dev server on http://localhost:8080
bun run dev

# Production build / dev mode build
bun run build
bun run build:dev

# Tests (Vitest with jsdom)
bun run test              # run once
bun run test:watch        # watch mode
bunx vitest run src/test/example.test.ts  # single test file
# Tests live in a mirror tree under src/test/ (not co-located with source):
# a source file at src/cad/sketch/geometry/vec2.ts is tested by
# src/test/cad/sketch/geometry/vec2.test.ts. Tests import source via the @/ alias.

# Lint (ESLint 9 flat config)
bun run lint
```

## Architecture

### Project Structure (Layers)

The codebase is organized into four strictly separated layers to decouple the UI from the CAD kernel:

1.  **`src/frontend/ui/` (The Interface)**: Pure frontend layer.
    *   React components, application layout.
    *   Depends on: `src/cad/types` (for data models), `src/worker/bridge` (for engine communication), and `src/frontend/shared`.

2.  **`src/frontend/viewport/` (The Visuals)**: Visualization and rendering layer.
    *   Three.js components (`OpenCascadeViewport`) and React-Three-Fiber overlays (`SketchOverlay`).
    *   Depends on: `src/cad/types` (for mesh/edge data formats) and `src/frontend/shared`.

3.  **`src/frontend/shared/` (Common State & Utilities)**: Zustand stores and shared logic.
    *   `projectStore.ts`: Zustand store holding the persisted `CADProject` + undo/redo history behind `dispatch(action)`/`undo`/`redo`; persisted via zustand `persist` (see below).
    *   `occStore.ts`: Zustand store holding worker-output state (`status`/`progress`/`error`/`mesh`/`currentShapeId`/`currentFeatureShapeId`/`sketchEdges`), written directly by `occWorkerClient`.
    *   `viewportStore.ts`: Zustand store for camera, selection, hover state, and ephemeral UI state (`activeTab`, `activeOperation`, `isSidebarOpen`, `activeSketchId`, `selectedTreeItem`, `itemErrors`, etc.).
    *   `useProjectState.ts`: Derived-read hooks over `projectStore` (`useProject`/`useFeatureTree`/`useRollbackBarIndex`/`useActiveSketch`), backed by `src/cad/state/projectSelectors.ts`.
    *   `projectApi.ts`: Imperative mutation functions (`addSketch`, `addFeature`, `updateFeatureParameters`, …) as plain, referentially-stable module functions over `projectStore.dispatch`.
    *   `theme/`: Mantine theme and CAD color palette.
    *   `useLocalStorage.ts`: Persistence helper.
    *   `src/frontend/ui/layout/cadLayoutUiStore.ts`: Zustand store for layout-scoped UI state (`activeSidebarTab`, `operationPanelOpen`/`editingFeatureId`, measurement picks).

4.  **`src/cad/` (The Engine)**: Core CAD logic, data models, and the project domain reducer.
    *   `solid/`: The OpenCascade.js kernel wrappers — 3D solid modeling only (runs inside the worker). `operations/` is split one-operation-per-file with `index.ts` barrels (`sketch/`, `primitives/`, `boolean/`, `rebuild/strategies/`, plus `faceGeometry.ts`/`edgeLoop.ts`/`resolveSelector.ts`/`exportShape.ts`/measure handlers). `modifications/`, `transforms/`, `advancedModeling/`, `analysis/` are similarly split with barrels. (Formerly `engine/`.)
    *   `sketch/`: The 2D sketch domain — **independent of OpenCascade** (different wasm runtime), grouped into cohesive subfolders each with an `index.ts` barrel: `solver/` (planegcs constraint solver — `SketchSolver.ts`, `constraintFactory.ts`, `elementsToPrimitives.ts`, `syncElementsFromPrimitives.ts`, `autoConstraints.ts`), `geometry/` (pure 2D geometry — `arcGeometry.ts`, `arcElementFactory.ts`, `vec2.ts`, `coordinateSystem.ts`, `originPoint.ts`, `sketchShapeBuilders.ts`), `interaction/` (hit-testing / selection / layout — `elementHitTest.ts`, `dimensionHandleHitTest.ts`, `dimensionLayout.ts`, `sketchBoxSelection.ts`, `sketchGroups.ts`, `constraintAnchors.ts`), and `drawTools/`. Foundational sketch-space value types (`ScreenPoint`, `ScreenRect`, `ResolvedEdge`, `ConstraintIconPlacement`) live in `src/cad/types/sketch`, not here. The one OCC-bound exception, `externalGeometry.ts` (sketch↔body reprojection), lives in `solid/sketch/`.
    *   `state/`: The project domain reducer — `projectReducer.ts` (pure `(project, action) => project`), `projectActions.ts` (entity constructors), `projectHelpers.ts` (shared pure helpers), `history.ts` (snapshot undo/redo), `projectSelectors.ts` (derived reads, e.g. `buildFeatureTree`).
    *   `types/`: Foundational CAD types (`CADProject`, `Feature`, `Sketch`, `SketchElement`) and engine output formats (`MeshData`), one-type-per-file grouped into cohesive modules (36 files total), consumed via the `@/cad/types` barrel.
    *   No dependencies on UI or Rendering layers.

5.  **`src/worker/` (The Bridge)**: Infrastructure for cross-thread communication.
    *   `bridge/opencascadeWorker.ts`: The Web Worker entry point.
    *   `bridge/occWorkerClient.ts`: Module-level singleton — spawns the Worker once, owns `onmessage`/`call()`/`pendingCalls`, writes `occStore` directly, and exposes imperative ops (`buildSketch`, `extrudeSketch`, `revolveSketch`, `rebuild`, `getFaceGeometry`, `deleteShape`, …) plus an event-subscription API (`on('sketchBuilt', …)` etc.). Being an ES module, it is naturally a singleton — no "instantiate exactly once" footgun.
    *   `src/frontend/ui/layout/hooks/useOCCSync.ts`: The one remaining React-glue hook — subscribes to `occWorkerClient` events (ref-to-latest-args pattern) and forwards them into `projectApi` setters; drives rebuild/remesh/clear off `src/cad/solid/rebuild/rebuildScheduler.ts`'s `shouldRebuild`. Returns nothing; components read `useOccStore` selectors and call `occWorkerClient` functions directly.
    *   `types/`: Strictly defined Request/Response DTOs for message passing (`src/worker/types/messages.ts` documents `CorrelatedCallMap` for the 5 `requestId`-correlated call-style ops: `resolveSelector`/`exportShape`/`measureShape`/`measureBetween`/`getEdgeLoop`; `buildSketch`/`extrudeSketch`/`revolveSketch`/`rebuild` stay event-style).

### Core Stack

- **React 18** + TypeScript (strict mode disabled, `noImplicitAny: false`)
- **OpenCascade.js** (2.0.0-beta): WASM CAD kernel in a Web Worker
- **Three.js** via @react-three/fiber for 3D rendering
- **Mantine UI 7**: Component library (dark theme). NOT shadcn/Tailwind despite legacy `cn()` in src/lib/utils.ts
- **@phosphor-icons/react**: Icon library
- **Vite** + SWC for builds
- **PostCSS**: `postcss-preset-mantine` + `postcss-simple-vars` for Mantine breakpoints

### Import Alias

`@` maps to `./src` — use for all imports: `import { useProject } from '@/frontend/shared/useProjectState'`

### Critical Vite Headers

SharedArrayBuffer requires these headers for OpenCascade WASM threading — without them, initialization silently fails:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### State Management

Zustand stores, split by durable-vs-ephemeral concern (no Redux, no single mega-hook):

- **`projectStore.ts`** (`src/frontend/shared/`): the durable domain model — `CADProject` (feature history, sketches, reference geometry, version tracking) behind `dispatch(action)` into the pure `src/cad/state/projectReducer.ts`, plus undo/redo (`src/cad/state/history.ts`). Persisted to localStorage under key `'occad-project'` via zustand `persist`, with a migration-tolerant storage layer that still reads the legacy bare-`CADProject` format.
- **`occStore.ts`** (`src/frontend/shared/`): worker-output state (`status`, `mesh`, `currentShapeId`, `currentFeatureShapeId`, `sketchEdges`, rebuild progress/error), written directly by `occWorkerClient`.
- **`viewportStore.ts`** (`src/frontend/shared/`): camera, selection, hover, and ephemeral UI state (active tab/operation, sidebar open, active sketch id, selected/hovered tree item).
- **`cadLayoutUiStore.ts`** (`src/frontend/ui/layout/`): layout-scoped UI state (active sidebar tab, operation panel open/editing feature, measurement picks) — kept local to the layout subtree rather than global.
- Reads go through `useProjectState.ts` selector hooks and `useOccStore`/`useViewportStore` selectors; writes go through `projectApi.ts` functions or `occWorkerClient` calls — components don't dispatch raw actions or reach into the worker client's internals directly.

### Data Types (src/cad/types/...)

```typescript
// project/projectShapes.ts, sketch/Sketch.ts (illustrative shapes; see @/cad/types barrel for the real, grouped files)
interface Sketch {
  id: string;
  name: string;
  plane: SketchPlane;           // { type: 'xy' | 'yz' | 'xz', offset?: number }
  elements: SketchElement[];    // Array of 2D geometry
  geometry?: ShapeReference;    // Reference to OpenCascade wire/face
  isClosed: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Feature {
  id: string;
  name: string;
  type: FeatureOperation;       // 'extrude-boss', 'revolved-cut', etc.
  sketchId?: string;            // Source sketch for sketch-based operations
  parameters?: OperationParams; // ExtrudeParams, RevolveParams, etc.
  geometry?: ShapeReference;    // Reference to OpenCascade shape
  parentIds: string[];          // Dependencies for rebuild order
  isSuppressed: boolean;        // Exclude from rebuild if true
  isVisible: boolean;
  createdAt: number;
  updatedAt: number;
}

interface CADProject {
  id: string;
  name: string;
  version: number;              // Increment to trigger rebuild
  referenceGeometry: ReferenceGeometry[];
  sketches: Sketch[];
  features: Feature[];
  createdAt: number;
  updatedAt: number;
}
```

### Project & Worker APIs

**Project reads/writes** (`src/frontend/shared/useProjectState.ts` + `projectApi.ts`):
```typescript
const project = useProject();             // Current CADProject
const featureTree = useFeatureTree();      // Derived tree (src/cad/state/projectSelectors.ts)

// projectApi.ts — imperative mutations, dispatch into projectReducer under the hood
addSketch(name, plane);                    // => Sketch
updateSketchElements(sketchId, elements);
updateSketchGeometry(sketchId, shapeRef);
deleteSketch(sketchId);
addFeature(name, type, params?, sketchId?, parentIds?); // => Feature
updateFeatureParameters(featureId, params);
updateFeatureGeometry(featureId, shapeRef);
toggleFeatureSuppression(featureId);
deleteFeature(featureId);
reorderFeature(featureId, newIndex);
```

**Worker client** (`src/worker/bridge/occWorkerClient.ts`, module-level singleton):
```typescript
import { occWorkerClient } from '@/worker/bridge/occWorkerClient';
import { useOccStore } from '@/frontend/shared/occStore';

const { status, mesh } = useOccStore();    // 'loading' | 'ready' | 'building' | 'error'; current mesh

occWorkerClient.buildSketch(sketchId, plane, elements);
occWorkerClient.extrudeSketch(featureId, sketchId, params);
occWorkerClient.revolveSketch(featureId, sketchId, params);
occWorkerClient.rebuild(project);
occWorkerClient.deleteShape(shapeId);
occWorkerClient.on('sketchBuilt', handler);   // event-subscription API
await occWorkerClient.call('measureShape', requestId, payload); // correlated call() for the 5 single-response ops
```

`src/frontend/ui/layout/hooks/useOCCSync.ts` is the glue that subscribes to `occWorkerClient` events and forwards them into `projectApi` setters, and drives rebuild/remesh/clear via `shouldRebuild` — most components should read `useOccStore`/`useProjectState` and call `occWorkerClient`/`projectApi` directly rather than going through a hook wrapper.

### Worker Architecture

OpenCascade runs in a Web Worker (src/worker/bridge/opencascadeWorker.ts). The `occWorkerClient` singleton (src/worker/bridge/occWorkerClient.ts) manages the worker lifecycle and message passing — spawned once at module load, not per-component. Core CAD logic resides in `src/cad/solid/`.

**Main Thread → Worker**: `buildSketch`, `extrudeSketch`, `revolveSketch`, `rebuild`, `getFaceGeometry`, `deleteShape` (Types in `src/worker/types/requests/`)

**Worker → Main Thread**: `ready`, `sketchBuilt`, `featureBuilt`, `rebuildComplete`, `rebuildProgress`, `faceGeometry`, `error` (Types in `src/worker/types/responses/`)

All mesh data uses transferable ArrayBuffers for zero-copy performance.

**Sketch Geometry → OCC Mapping (src/cad/solid/sketchBuilders.ts):**

| Sketch Operation | OpenCascade API Used |
|------------------|---------------------|
| Line | `GC_MakeSegment` → `BRepBuilderAPI_MakeEdge` |
| Circle | `GC_MakeCircle` → edge |
| Arc | `GC_MakeArcOfCircle` (3-point or center-radius) |
| Rectangle | 4 × `GC_MakeSegment` → closed wire |
| Polygon | N × `GC_MakeSegment` → closed wire |
| Ellipse | `GC_MakeEllipse` → edge |
| Spline | `GeomAPI_PointsToBSpline` → edge |

All edges are combined into a `TopoDS_Wire` via `BRepBuilderAPI_MakeWire`, then converted to a `TopoDS_Face` via `BRepBuilderAPI_MakeFace` (if closed).

**3D Operations → OCC Mapping (src/cad/solid/operations.ts):**

| Operation | OpenCascade API |
|-----------|----------------|
| Extrude | `BRepPrimAPI_MakePrism_1(face, vector, copy, canonize)` |
| Revolve | `BRepPrimAPI_MakeRevol_1(face, axis, angle, copy)` |
| Union | `BRepAlgoAPI_Fuse_3(shape1, shape2, progressRange)` |
| Subtract | `BRepAlgoAPI_Cut_3(shape1, shape2, progressRange)` |
| Intersect | `BRepAlgoAPI_Common_3(shape1, shape2, progressRange)` |

### Component Structure

- **App.tsx**: Providers (src/frontend/ui/App.tsx)
- **CADLayout**: Thin orchestrator; calls layout hooks (src/frontend/ui/layout/hooks/) in dependency order then composes three layout components (src/frontend/ui/CADLayout.tsx)
  - **CADHeader**, **CADSidebar**, **CADMainCanvas** (src/frontend/ui/layout/components/): zero-prop components reading `CADLayoutContext` + `cadLayoutUiStore`. `CADMainCanvas` renders `OpenCascadeViewport` directly (no `CADViewport` pass-through — that component was deleted).
- **OpenCascadeViewport**: Three.js viewport orchestrator; reads `mesh`/`status`/`error`/`progress`/`sketchEdges` from `useOccStore` itself (src/frontend/viewport/opencascade/OpenCascadeViewport.tsx). It stays at the folder root; the rest of `opencascade/` is grouped into subfolders (each with an `index.ts` barrel): `overlays/` (2D HUD — `SketchModeControls`, `SketchPlanePrompt`, `SketchConstraintsMenu`, `SketchSelectionBox`, `ViewportEmptyState`, `LoadingOverlay`, `ErrorOverlay`), `scene/` (R3F scene-graph — `Scene`, `OCCModel`, `FaceMesh`, `EdgeWireframe`, `EdgeHoverCylinders`, `VertexPoints`, `SelectionDisplay`, `OriginPoint`, `ReferencePlanes`, `SketchWireframes`, `ExtrudeArrows`), and `geometry/` (pure helpers — `occGeometry`, `edgeSegments`, `referencePlaneGeometry`, `cameraMouseButtons`, `useDisableRaycastInSketchMode`).
- **SketchOverlay**: 3D sketch overlay orchestrator, composed from `viewport/sketch/hooks/` (snapping, dimension tool, box selection, keyboard actions) and `viewport/sketch/components/` (src/frontend/viewport/sketch/SketchOverlay.tsx)
- **FeatureTree**: Hierarchical tree; CRUD/reorder callbacks provided via `FeatureTreeActionsContext`, not prop drilling (src/frontend/ui/FeatureTree/FeatureTree.tsx)
- **OperationsBar**: Top operations bar (src/frontend/ui/operations/OperationsBar.tsx)
- **Toolbar**: File/View toolbar (src/frontend/ui/Toolbar.tsx)
- **OperationPanel**: Thin shell (~120 lines) that looks up a per-operation Strategy component in `src/frontend/ui/operations/strategies/registry.ts` and renders header/content/footer chrome around it (src/frontend/ui/operations/OperationPanel.tsx). Each Strategy panel reports its current params via a push-based `onChange: (draft: PanelDraft | null) => void` prop — there is no `forwardRef`/`useImperativeHandle` contract in this codebase (`grep -rn "useImperativeHandle" src/` returns nothing).

### Sketch System

The **SketchOverlay** component provides a 3D overlay with grid snapping (toggle with 'G' key) and constraint-based snapping (point, midpoint, center, edge constraints).

It supports: Point, Line, Rectangle, Circle, Polygon, Arc drawing operations. Keyboard: ESC aborts the in-progress element or (when none) exits sketch mode, ENTER completes polygon, G toggles grid snap, H toggles grid visibility, Ctrl/Cmd+A selects all sketch entities, DEL deletes selected.

### Face Selection → Sketch Workflow

Select face → `getFaceGeometry` extracts plane origin/normal from worker → create sketch on that plane.

### Theme (src/frontend/shared/theme/mantine.ts)

Dark theme with custom CAD color palette. Primary: Cyan (#0dc2ff), Accent: Purple (#a64dff). CAD-specific colors in `theme.other.colors` (toolbar, canvas, grid, divider, header backgrounds + gradients).

## Coding Preferences

- **No raw `<div>` elements** — always use Mantine's `<Box>` (or other semantic Mantine components) instead of plain `<div>` tags.
- **3D model changes require tests** — when modifying anything related to 3D models, OpenCascade, the viewport, sketches, or features, create/update tests and run the test suite to check for regressions before considering the task complete.

## Development Workflow

### After Refactoring Imports

When removing a hook/import from a file, **scan the entire file for other usages before dropping the import**. Multi-component files often have internal components that use hooks (`useRef`, `useEffect`, etc.) even if the main exported component no longer does. The build (`bun run build`) will NOT catch missing React hook imports — they only fail at **runtime** with `ReferenceError: useRef is not defined`. Always:

1. After modifying imports, grep the file for all removed symbols (e.g. `useRef`, `useEffect`)
2. Run `bun run build` to catch type errors
3. Run `bun run test` to catch test regressions
4. **Load the app in the browser** (`bun run dev`) to catch runtime-only errors that the build misses

## Development Guidelines

### Adding New Sketch Elements

1. Add type to `SketchElement` union in `src/cad/types/sketch/SketchElement.ts`
2. Implement builder in src/cad/solid/sketchBuilders.ts
3. Add operation icon/handler to OperationsBar
4. Add drawing logic to `SketchOverlay`

### Adding New Features

1. Add feature type to `FeatureOperation` and parameter interface in `src/cad/types/operations/` (e.g. `sketchFeatureParams.ts`/`modificationParams.ts`/`OperationParams.ts` depending on category)
2. Add worker message type to `src/worker/types/requests/` and `responses/`
3. Implement handler under `src/cad/solid/operations/` (add a new file in the relevant subfolder — `sketch/`, `primitives/`, `boolean/`, or a sibling top-level module — and export it from that folder's `index.ts` barrel)
4. Add a `FeatureStrategy` entry to `src/cad/solid/operations/rebuild/strategies/registry.ts` (`FEATURE_STRATEGY_REGISTRY`) for parametric rebuild — a missing entry fails loudly rather than silently no-opping
5. Add UI controls in `OperationsBar` + a new Strategy component under `src/frontend/ui/operations/strategies/`, registered in that folder's `registry.ts`

### Parametric Rebuild (src/cad/solid/operations/rebuild/handleRebuild.ts)

1. Clear all shape storage
2. **Pass 1**: Rebuild all sketches (wire/face construction)
3. **Pass 2**: Rebuild features in order via the `FEATURE_STRATEGY_REGISTRY` lookup (no `feature.type` branching in the shared loop — each strategy decides `produce`/`replace`/`noop` and, for `produce`, its own `combine: 'union' | 'subtract'`):
   - For each non-suppressed feature, dispatch to its registered strategy
   - Producing strategies auto-combine with the current body per their own `combine` decision
   - Store result shape
4. Tessellate final body
5. Send mesh data to viewport

Triggered by incrementing `project.version` and calling `occWorkerClient.rebuild(project)`; `src/cad/solid/rebuild/rebuildScheduler.ts`'s `shouldRebuild` decides whether a project change should trigger a full rebuild, a remesh-only, a clear, or nothing.

## OCC Features In Use

OCCT classes currently wired into the app (see "Status summary" below for feature-level status):

**Primitives** (`operations/primitives/*.ts`): `BRepPrimAPI_MakeBox`, `MakeCylinder`, `MakeSphere_1`, `MakeCone_1`, `MakeTorus_1`, `MakeWedge_1`

**Sketch-based** (`operations/sketch/extrudeSketch.ts`, `revolveSketch.ts`): `BRepPrimAPI_MakePrism_1` (extrude), `BRepPrimAPI_MakeRevol_1` (revolve)

**Booleans** (`operations/boolean/*.ts`): `BRepAlgoAPI_Fuse_3`, `Cut_3`, `Common_3`

**Modifications** (`modifications/{fillet,chamfer,shell,offset}.ts`): `BRepFilletAPI_MakeFillet` (fillet), `BRepFilletAPI_MakeChamfer` (chamfer), `BRepOffsetAPI_MakeThickSolid` (shell), `BRepOffsetAPI_MakeOffsetShape` (offset)

**Transforms** (`transforms/{move,rotate,mirror,scale}.ts`): `gp_Trsf.SetTranslation` / `SetRotation_1` / `SetMirror_3` / `SetScale`, applied via `BRepBuilderAPI_Transform_2`

**Advanced modeling** (`advancedModeling/{sweep,loft}.ts`): `BRepOffsetAPI_MakePipe_1` (sweep), `BRepOffsetAPI_ThruSections` (loft)

**Import/Export** (`io.ts`, via `oc.FS`): `STEPControl_Reader`/`Writer`, `IGESControl_Reader`/`Writer`, `StlAPI_Writer` (STL export meshes first with `BRepMesh_IncrementalMesh`)

**Analysis** (`analysis.ts`): `BRepGProp`/`GProp_GProps` (volume), `Bnd_Box`/`BRepBndLib` (bounding box), `BRepExtrema_DistShapeShape` (measure-between distance), `BRepAdaptor_Surface`/`Curve` (measure-between angle)

**Topology** (`fingerprint.ts`, `faceAttribution.ts`, `edgeLoop.ts`): `TopExp_Explorer`, `TopTools_IndexedMapOfShape`, `BRep_Tool.Pnt`, GProp measures + OBB for geometric fingerprints

**Constraints:** planegcs (`@salusoft89/planegcs`), not an OCC solver — runs in the worker via `SketchSolver.ts`.

## OCC Features Available But Not Used

Available in `opencascade.full.wasm` but not wired in:

- **Advanced modeling:** `BRepOffsetAPI_DraftAngle` (draft), `BRepOffsetAPI_MakePipeShell` (swept with guide)
- **Import/Export:** `RWGltf_CafWriter` (glTF/GLB export) and `RWObj_CafReader` (OBJ import) — both need a custom WASM build (see below); `StlAPI_Reader` (STL import)
- **Shape Healing:** `ShapeFix_Shape`/`Wire`/`Face`, `BRepCheck_Analyzer` — intentionally not planned (see "Won't implement" below)
- **Assembly & Metadata (XCAF):** `XCAFDoc_ColorTool`, `ShapeTool`, `MaterialTool`, `LayerTool`
- **Advanced curves/surfaces:** `Geom_BezierCurve`, `GeomFill_Pipe`, `GeomFill_BSplineCurves`, `GeomAPI_ProjectPointOnCurve`, `GeomAPI_IntCS`/`IntSS`

## Known Limitations

- Bezier curves defined in types but not implemented in worker (won't implement — see "Won't implement" below)
- Custom sketch planes: XY, XZ, YZ fully work; no custom-plane / axis creation
- **OBJ import & glTF export are blocked on the prebuilt WASM:** `RWObj_CafReader` traps with a `null function` (unbound symbol) in `opencascade.full.wasm`; enabling either needs a custom (trimmed) opencascade.js build that binds the missing `RWObj`/`RWMesh`/`RWGltf` symbols
- TypeScript strict mode disabled — many type safety features off for rapid prototyping

## Status summary

Tracking progress toward a **fully-featured OpenCascade CAD wrapper**: all primitives & features, a
feature tree, undo/redo history, and a constraint-based sketch solver.

Legend: ✅ Done & wired end-to-end · 🟡 Partial · ❌ Not started · 🚫 Won't implement

> **How to read this:** a feature is only ✅ when **types + engine + rebuild + UI** all exist. "Engine" =
> handler in the Web Worker (`src/cad/solid/*`). "Rebuild" = handled by the `FEATURE_STRATEGY_REGISTRY` in
> `src/cad/solid/operations/rebuild/handleRebuild.ts` for parametric history replay. "UI" = button/panel in
> `OperationsBar`/`OperationPanel`.
>
> This section tracks *status*, not history — the detailed fix-by-fix narrative lives in git, not in this
> file. Keep it that way: when you finish something, flip its status and delete the stale "todo" text rather
> than appending a dated log.

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

## Won't implement (decided)

- **Bezier splines** — type + toolbar button exist but no builder; dead button, intentionally left.
- **Spline** — removed entirely (was half-implemented).
- **Symmetric constraint** — out of scope (planegcs `p2p_symmetric_ppl` exists but not wired).
- **glTF / GLB export** — needs a custom WASM build; not pursued.
- **OBJ import** — engine path exists but `RWObj_CafReader` traps with `null function` (unbound symbol) in
  the prebuilt `opencascade.full.wasm`; needs a custom WASM build.
- **Model box/crossing select** — model faces/edges/vertices stay single-pick (sketch box/crossing is done).
- **Shape validity check / shape healing** (`BRepCheck_Analyzer`, `ShapeFix_*`) — not planned.
- **Boolean exact-history resolution** — `src/cad/solid/history.ts` is a ready scaffold over
  `BRepTools_History`, but for the current selection model (selection-origin == use-point) fingerprints
  already re-anchor selections across renumbers. Not being built; scaffold left in place.
- **CadQuery / OCP kernel** — same OCCT kernel we already wrap, no client-side runtime, and we already beat
  it on constraints. Evaluated and rejected; mined for the selector system (done) instead.

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
- `occWorkerClient` is a module-level singleton spawning **one** Worker — do not add a second
  `useOpenCascade`-style hook or worker instantiation; a second call would spawn a separate worker with
  isolated shape storage.
- Unit tests mock OCC (`mockCtx`); real geometric validity is **e2e / browser only**. Keep fingerprint and
  rebuild logic pure and `oc`-injected so it stays mockable.
- The worker's **single interleaved** sketch+feature pass is intentional (external-geometry sketches
  re-project against `currentBody` at their point in the order). Do **not** split into "all sketches then
  all features".

## Known architectural debt

Not bugs, but flagged for whoever does the next substantial pass (each needs real e2e/browser verification,
not a mechanical edit):

- **Constraint-solver pipeline runs in the UI layer** (`CADLayout.tsx`: `mapElementsToPrimitives`,
  `inferAutoConstraints`, `createConstraint`) instead of behind `src/worker/bridge` — a layering violation
  per this file's own architecture doc.
- **`viewportStore` has three parallel "something is happening on the canvas" flags**
  (`draggingDimensionLabel`, `pendingSketchOnFace`, `extrudePreview`) — a generalized `interactionMode`
  union would scale better.
- **`handleRebuild`'s per-op strategies re-implement** extrude/revolve construction already in
  `handleExtrudeSketch`/`handleRevolveSketch` — the boss-vs-cut re-derivation from `feature.type` is now
  confined to each strategy's own `combine` decision instead of leaking into the shared loop, but the
  duplicate OCC construction code itself is still separate.
- **Worker dispatch has no request-id correlation for the state-mutating ops** — a targeted sketch build
  and a version-bump rebuild can race against the same worker-side `shapeStorage`. The 5
  `requestId`-carrying, single-response ops (`resolveSelector`/`exportShape`/`measureShape`/
  `measureBetween`/`getEdgeLoop`) do correlate via `occWorkerClient`'s generic `call()`; this note is about
  `buildSketch`/`extrudeSketch`/`revolveSketch`/`rebuild`, which stay event-style.
- **`OCCModel.tsx` per-edge hover cylinders / highlight geometry** are unmemoized and recompute on every
  hover/selection change.
