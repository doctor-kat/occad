# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Update ROADMAP.md After Any Work

After completing any work in this repository, update `ROADMAP.md` to reflect the change (mark items done, add new follow-ups, adjust status). Do this before considering the task complete.

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

# Lint (ESLint 9 flat config)
bun run lint
```

## Architecture

### Project Structure (Layers)

The codebase is organized into four strictly separated layers to decouple the UI from the CAD kernel:

1.  **`src/frontend/ui/` (The Interface)**: Pure frontend layer.
    *   React components, application layout.
    *   Depends on: `src/cad/types` (for data models), `src/worker/bridge` (for engine communication), and `src/frontend/shared`.

2.  **`src/frontend/canvas/` (The Visuals)**: Visualization and rendering layer.
    *   Three.js components (`OpenCascadeViewport`) and React-Three-Fiber overlays (`SketchOverlay`).
    *   Depends on: `src/cad/types` (for mesh/edge data formats) and `src/frontend/shared`.

3.  **`src/frontend/shared/` (Common State & Utilities)**: Centralized state management and shared logic.
    *   `useCADState.ts`: Manages the project state, feature tree, and UI-level CRUD operations.
    *   `viewportStore.ts`: Zustand store for camera, selection, and hover state.
    *   `theme/`: Mantine theme and CAD color palette.
    *   `useLocalStorage.ts`: Persistence helper.

4.  **`src/cad/` (The Engine)**: Core CAD logic and data models.
    *   `engine/`: Pure TypeScript wrappers for OpenCascade.js operations (runs inside the worker).
    *   `types/`: Foundational CAD types (`Project`, `Feature`, `SketchElement`) and engine output formats (`MeshData`).
    *   No dependencies on UI or Rendering layers.

5.  **`src/worker/` (The Bridge)**: Infrastructure for cross-thread communication.
    *   `bridge/opencascadeWorker.ts`: The Web Worker entry point.
    *   `bridge/useOpenCascade.ts`: The React hook used by the UI to send commands to the engine.
    *   `types/`: Strictly defined Request/Response DTOs for message passing.

### Core Stack

- **React 18** + TypeScript (strict mode disabled, `noImplicitAny: false`)
- **OpenCascade.js** (2.0.0-beta): WASM CAD kernel in a Web Worker
- **Three.js** via @react-three/fiber for 3D rendering
- **Mantine UI 7**: Component library (dark theme). NOT shadcn/Tailwind despite legacy `cn()` in src/lib/utils.ts
- **@phosphor-icons/react**: Icon library
- **Vite** + SWC for builds
- **PostCSS**: `postcss-preset-mantine` + `postcss-simple-vars` for Mantine breakpoints

### Import Alias

`@` maps to `./src` — use for all imports: `import { useCADState } from '@/frontend/shared/useCADState'`

### Critical Vite Headers

SharedArrayBuffer requires these headers for OpenCascade WASM threading — without them, initialization silently fails:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### State Management

Custom hook-based (not Redux/Zustand). Central state in `useCADState` (src/frontend/shared/useCADState.ts):
- CADProject: feature history, sketches, reference geometry, version tracking
- Operation/tab/selection state, sketch editing state, rebuild progress
- Auto-persisted to localStorage under key `'occad-project'`

### Data Types (src/cad/types/...)

```typescript
// project.ts
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

### Hook APIs

**useCADState** (src/frontend/shared/useCADState.ts):
```typescript
const {
  project,                      // Current CAD project
  // Sketch management
  addSketch,                    // (name, plane) => Sketch
  updateSketchElements,         // (sketchId, elements) => void
  updateSketchGeometry,         // (sketchId, shapeRef) => void
  startSketchEdit,              // (sketchId) => void
  stopSketchEdit,               // () => void
  deleteSketch,                 // (sketchId) => void
  // Feature management
  addFeature,                   // (name, type, params?, sketchId?, parentIds?) => Feature
  updateFeatureParameters,      // (featureId, params) => void
  updateFeatureGeometry,        // (featureId, shapeRef) => void
  toggleFeatureSuppression,     // (featureId) => void
  deleteFeature,                // (featureId) => void
  reorderFeature,               // (featureId, newIndex) => void
  // Rebuild
  triggerRebuild,               // () => void
  rebuildState,                 // { isRebuilding, progress, error? }
} = useCADState();
```

**useOpenCascade** (src/worker/bridge/useOpenCascade.ts):
```typescript
const {
  status,                       // 'loading' | 'ready' | 'building' | 'error'
  mesh,                         // Current mesh data for viewport
  // Operations
  buildSketch,                  // (sketchId, plane, elements) => void
  extrudeSketch,                // (featureId, sketchId, params) => void
  revolveSketch,                // (featureId, sketchId, params) => void
  rebuild,                      // (project) => void
  deleteShape,                  // (shapeId) => void
} = useOpenCascade({ ... });
```

### Worker Architecture

OpenCascade runs in a Web Worker (src/worker/bridge/opencascadeWorker.ts). The hook `useOpenCascade` (src/worker/bridge/useOpenCascade.ts) manages the worker lifecycle and message passing. Core CAD logic resides in `src/cad/engine/`.

**Main Thread → Worker**: `buildSketch`, `extrudeSketch`, `revolveSketch`, `rebuild`, `getFaceGeometry`, `deleteShape` (Types in `src/worker/types/requests/`)

**Worker → Main Thread**: `ready`, `sketchBuilt`, `featureBuilt`, `rebuildComplete`, `rebuildProgress`, `faceGeometry`, `error` (Types in `src/worker/types/responses/`)

All mesh data uses transferable ArrayBuffers for zero-copy performance.

**Sketch Geometry → OCC Mapping (src/cad/engine/sketchBuilders.ts):**

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

**3D Operations → OCC Mapping (src/cad/engine/operations.ts):**

| Operation | OpenCascade API |
|-----------|----------------|
| Extrude | `BRepPrimAPI_MakePrism_1(face, vector, copy, canonize)` |
| Revolve | `BRepPrimAPI_MakeRevol_1(face, axis, angle, copy)` |
| Union | `BRepAlgoAPI_Fuse_3(shape1, shape2, progressRange)` |
| Subtract | `BRepAlgoAPI_Cut_3(shape1, shape2, progressRange)` |
| Intersect | `BRepAlgoAPI_Common_3(shape1, shape2, progressRange)` |

### Component Structure

- **App.tsx**: Providers (src/frontend/ui/App.tsx)
- **CADLayout**: Main orchestrator (src/frontend/ui/components/CADLayout.tsx)
- **CADViewport**: Main viewport container (src/frontend/canvas/components/CADViewport.tsx)
- **OpenCascadeViewport**: Three.js viewport (src/frontend/canvas/components/OpenCascadeViewport.tsx)
- **SketchOverlay**: 3D sketch overlay (src/frontend/canvas/components/SketchOverlay.tsx)
- **FeatureTree**: Hierarchical tree (src/frontend/ui/components/FeatureTree.tsx)
- **OperationsBar**: Top operations bar (src/frontend/ui/components/OperationsBar.tsx)
- **Toolbar**: File/View toolbar (src/frontend/ui/components/Toolbar.tsx)
- **OperationPanel**: Parameter input (src/frontend/ui/components/OperationPanel.tsx)

### Sketch System

The **SketchOverlay** component provides a 3D overlay with grid snapping (toggle with 'G' key) and constraint-based snapping (point, midpoint, center, edge constraints).

It supports: Line, Rectangle, Circle, Polygon, Arc drawing operations. Keyboard: ESC cancels/clears, ENTER completes polygon, G toggles grid snap, DEL deletes selected.

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
2. Implement builder in src/cad/engine/sketchBuilders.ts
3. Add operation icon/handler to OperationsBar
4. Add drawing logic to `SketchOverlay`

### Adding New Features

1. Add feature type to `FeatureOperation` and parameter interface in src/cad/types/operations/ and operation-params.ts
2. Add worker message type to `src/worker/types/requests/` and `responses/`
3. Implement handler in src/cad/engine/operations.ts
4. Add case to `handleRebuild` in operations.ts for parametric rebuild
5. Add UI controls in OperationsBar + OperationPanel

### Parametric Rebuild (src/cad/engine/operations.ts)

1. Clear all shape storage
2. **Pass 1**: Rebuild all sketches (wire/face construction)
3. **Pass 2**: Rebuild features in order:
   - For each non-suppressed feature
   - Execute operation (extrude, revolve, etc.)
   - Apply boolean operation with current body (Boss = union, Cut = subtract)
   - Store result shape
4. Tessellate final body
5. Send mesh data to viewport

Triggered by incrementing `project.version` and calling `rebuild(project)` on the worker.

## Available OCC Features Not Yet Used

The following are available in opencascade.js but not yet implemented in this project:

**Primitives:** `BRepPrimAPI_MakeBox`, `BRepPrimAPI_MakeSphere`, `BRepPrimAPI_MakeCone`, `BRepPrimAPI_MakeTorus`, `BRepPrimAPI_MakeWedge`

**Advanced Modeling:** `BRepFilletAPI_MakeChamfer` (chamfer), `BRepOffsetAPI_DraftAngle` (draft), `BRepOffsetAPI_MakeOffsetShape` (offset), `BRepOffsetAPI_MakePipe` / `MakePipeShell` (sweep), `BRepOffsetAPI_ThruSections` (loft)

**Import/Export:** `STEPControl_Reader` / `Writer`, `IGESControl_Reader` / `Writer`, `StlAPI_Reader` / `Writer`, `RWGltf_CafWriter` (glTF/GLB), `RWObj_CafReader` (OBJ)

**Shape Healing:** `ShapeFix_Shape` / `Wire` / `Face`, `BRepCheck_Analyzer`

**Assembly & Metadata (XCAF):** `XCAFDoc_ColorTool`, `XCAFDoc_ShapeTool`, `XCAFDoc_MaterialTool`, `XCAFDoc_LayerTool`

**Analysis:** `BRepGProp` / `GProp_GProps` (volume, area, center of mass), `Bnd_Box` / `BRepBndLib` (bounding boxes)

**Transforms:** `gp_Trsf.SetMirror()`, `gp_Trsf.SetScale()`, `gp_Trsf.SetRotation()`

**Advanced Curves/Surfaces:** `Geom_BezierCurve`, `GeomFill_Pipe`, `GeomFill_BSplineCurves`, `GeomAPI_ProjectPointOnCurve`, `GeomAPI_IntCS` / `IntSS`

## Known Limitations

- Bezier curves defined in types but not implemented in worker
- Custom sketch planes: XY, XZ, YZ fully work; face-based planes partially implemented
- No constraint solver (pure explicit geometry)
- TypeScript strict mode disabled — many type safety features off for rapid prototyping

Implemented since this list was first written: fillet/chamfer/shell/offset (engine + rebuild + e2e); snapshot undo/redo; selection stability across rebuilds (geometric fingerprints) — see the "Deterministic topology & stable selections" section in `ROADMAP.md`.
