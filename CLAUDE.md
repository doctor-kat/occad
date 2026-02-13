# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Core Stack

- **React 18** + TypeScript (strict mode disabled, `noImplicitAny: false`)
- **OpenCascade.js** (2.0.0-beta): WASM CAD kernel in a Web Worker
- **Three.js** via @react-three/fiber for 3D rendering
- **Mantine UI 7**: Component library (dark theme). NOT shadcn/Tailwind despite legacy `cn()` in src/lib/utils.ts
- **@phosphor-icons/react**: Icon library
- **Vite** + SWC for builds
- **PostCSS**: `postcss-preset-mantine` + `postcss-simple-vars` for Mantine breakpoints

### Import Alias

`@` maps to `./src` — use for all imports: `import { useCADState } from '@/hooks/useCADState'`

### Critical Vite Headers

SharedArrayBuffer requires these headers for OpenCascade WASM threading — without them, initialization silently fails:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### State Management

Custom hook-based (not Redux/Zustand). Central state in `useCADState` (src/hooks/useCADState.ts):
- CADProject: feature history, sketches, reference geometry, version tracking
- Tool/tab/selection state, sketch editing state, rebuild progress
- Auto-persisted to localStorage under key `'occad-project'`

### Data Types

```typescript
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
  type: FeatureTool;            // 'extrude-boss', 'revolved-cut', etc.
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

**useCADState** (src/hooks/useCADState.ts):
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

**useOpenCascade** (src/hooks/useOpenCascade.ts):
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

OpenCascade runs in a Web Worker (src/workers/opencascadeWorker.ts, ~1280 lines). The hook `useOpenCascade` (src/hooks/useOpenCascade.ts) manages the worker lifecycle and message passing.

**Main Thread → Worker**: `buildSketch`, `extrudeSketch`, `revolveSketch`, `rebuild`, `getFaceGeometry`, `deleteShape`

**Worker → Main Thread**: `ready`, `sketchBuilt`, `featureBuilt`, `rebuildComplete`, `rebuildProgress`, `faceGeometry`, `error`

All mesh data uses transferable ArrayBuffers for zero-copy performance.

**Sketch Geometry → OCC Mapping:**

| Sketch Tool | OpenCascade API Used |
|-------------|---------------------|
| Line | `GC_MakeSegment` → `BRepBuilderAPI_MakeEdge` |
| Circle | `GC_MakeCircle` → edge |
| Arc | `GC_MakeArcOfCircle` (3-point or center-radius) |
| Rectangle | 4 × `GC_MakeSegment` → closed wire |
| Polygon | N × `GC_MakeSegment` → closed wire |
| Ellipse | `GC_MakeEllipse` → edge |
| Spline | `GeomAPI_PointsToBSpline` → edge |
| Bezier | `Geom_BezierCurve` (TODO — console.warn only) |

All edges are combined into a `TopoDS_Wire` via `BRepBuilderAPI_MakeWire`, then converted to a `TopoDS_Face` via `BRepBuilderAPI_MakeFace` (if closed).

**3D Operations → OCC Mapping:**

| Operation | OpenCascade API |
|-----------|----------------|
| Extrude | `BRepPrimAPI_MakePrism_1(face, vector, copy, canonize)` |
| Revolve | `BRepPrimAPI_MakeRevol_1(face, axis, angle, copy)` |
| Union | `BRepAlgoAPI_Fuse_3(shape1, shape2, progressRange)` |
| Subtract | `BRepAlgoAPI_Cut_3(shape1, shape2, progressRange)` |
| Intersect | `BRepAlgoAPI_Common_3(shape1, shape2, progressRange)` |

**NOT implemented (types exist but stubbed):**
- Bezier curves (console.warn only)
- Sphere, Cylinder, Cone, Torus primitives
- Fillet, Chamfer, Shell/Hollow, Sweep/Loft
- Import/Export (STEP, IGES, STL, glTF)

### OCC API Conventions

All OCC class constructors are suffixed with a number indicating the overload, e.g. `gp_Pnt_3(x, y, z)` is the 3rd constructor overload of `gp_Pnt`.

| Task | OCC API |
|------|---------|
| Point | `new oc.gp_Pnt_3(x, y, z)` |
| Direction | `new oc.gp_Dir_4(x, y, z)` |
| Vector | `new oc.gp_Vec_4(x, y, z)` |
| Axis | `new oc.gp_Ax1_2(origin, direction)` |
| Coordinate system | `new oc.gp_Ax2_3(origin, zDir, xDir)` |
| Extrude | `new oc.BRepPrimAPI_MakePrism_1(face, vec, copy, canonize)` |
| Revolve | `new oc.BRepPrimAPI_MakeRevol_1(face, axis, angle, copy)` |
| Boolean union | `new oc.BRepAlgoAPI_Fuse_3(s1, s2, progressRange)` |
| Boolean cut | `new oc.BRepAlgoAPI_Cut_3(s1, s2, progressRange)` |
| Boolean intersect | `new oc.BRepAlgoAPI_Common_3(s1, s2, progressRange)` |
| Tessellate | `new oc.BRepMesh_IncrementalMesh_2(shape, defl, rel, ang, parallel)` |
| Face iterator | `new oc.TopExp_Explorer_2(shape, TopAbs_FACE, TopAbs_SHAPE)` |
| Get triangulation | `oc.BRep_Tool.Triangulation(face, location)` |
| Progress range | `new oc.Message_ProgressRange_1()` |

### Component Structure

- **App.tsx**: Providers — MantineProvider, Notifications, ModalsProvider, QueryClientProvider, BrowserRouter
- **CADLayout**: Main orchestrator — coordinates HeaderBar, FeatureTabs, FeatureTree, viewport, and worker
- **CADViewport**: Three.js canvas for 3D visualization
- **OpenCascadeViewport**: OpenCascade-specific viewport with mesh rendering
- **SketchCanvas**: 2D orthographic sketch editor (standalone mode, 200x200 unit plane, 10-unit grid)
- **SketchOverlay**: 3D sketch overlay on arbitrary planes (in-viewport mode) — includes constraint snapping
- **FeatureTree**: Hierarchical tree of reference geometry, sketches, features
- **FeatureTabs**: Toolbar with categorized tools (Features, Sketch, Evaluate, Transform, I/O)
- **ExtrudeDialog**: Parameter input for extrude operations

### Dual Sketch System

Two independent sketch components implement the same drawing tools:
1. **SketchCanvas** — 2D orthographic view with grid snapping (toggle with 'G' key)
2. **SketchOverlay** — 3D overlay with constraint-based snapping (point, midpoint, center, edge constraints)

Both support: Line, Rectangle, Circle, Polygon, Arc drawing tools. Keyboard: ESC cancels, ENTER completes polygon, G toggles grid snap.

### Face Selection → Sketch Workflow

Select face → `getFaceGeometry` extracts plane origin/normal from worker → create sketch on that plane.

### Theme (src/theme/mantine.ts)

Dark theme with custom CAD color palette. Primary: Cyan (#0dc2ff), Accent: Purple (#a64dff). CAD-specific colors in `theme.other.colors` (toolbar, canvas, grid, divider, header backgrounds + gradients).

## Coding Preferences

- **No raw `<div>` elements** — always use Mantine's `<Box>` (or other semantic Mantine components) instead of plain `<div>` tags.
- **3D model changes require tests** — when modifying anything related to 3D models, OpenCascade, the viewport, sketches, or features, create/update tests and run the test suite to check for regressions before considering the task complete.

## Development Workflow

### After Refactoring Imports

When removing a hook/import from a file, **scan the entire file for other usages before dropping the import**. Multi-component files (like `OpenCascadeViewport.tsx`) often have internal components that use hooks (`useRef`, `useEffect`, etc.) even if the main exported component no longer does. The build (`bun run build`) will NOT catch missing React hook imports — they only fail at **runtime** with `ReferenceError: useRef is not defined`. Always:

1. After modifying imports, grep the file for all removed symbols (e.g. `useRef`, `useEffect`)
2. Run `bun run build` to catch type errors
3. Run `bun run test` to catch test regressions
4. **Load the app in the browser** (`bun run dev`) to catch runtime-only errors that the build misses

## Development Guidelines

### Adding New Sketch Elements

1. Add type to `SketchElement` union in src/types/cad.ts
2. Implement builder in src/workers/opencascadeWorker.ts
3. Add case to `buildSketchWire` switch
4. Add tool icon/handler to FeatureTabs
5. Add drawing logic to both SketchCanvas and SketchOverlay

### Adding New Features

1. Add feature type to `FeatureTool` and parameter interface in src/types/cad.ts
2. Add worker message type to `WorkerRequest`/`WorkerResponse`
3. Implement handler in opencascadeWorker.ts
4. Add case to `handleRebuild` for parametric rebuild
5. Add UI controls in FeatureTabs + parameter dialog

### Parametric Rebuild

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
- Fillet, chamfer, shell operations defined but not implemented
- No constraint solver (pure explicit geometry)
- No undo/redo system
- TypeScript strict mode disabled — many type safety features off for rapid prototyping
