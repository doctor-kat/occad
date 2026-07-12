import type { OpenCascadeInstance, TopoDS_Shape, TopoDS_Edge, TopoDS_Vertex } from 'opencascade.js';
import { Sketch } from '../../types/sketch/Sketch';
import { SketchPrimitive } from '../../types/sketch/SketchPrimitive';
import { Workplane } from '../../types/sketch/Workplane';
import { Point2D, Point3D } from '../../types/geometry/primitives';
import { GeometryRef, StableRef, SubShapeKind } from '../../types/geometry/shapeRefs';
import { toStableRef, parseRefString, SketchRefEnrichment } from '../../types/geometry/Fingerprint';
import { project } from './coordinateSystem';
import { WorkerContext } from '../workerContext';
import { fingerprintAll, resolveAgainst } from '../fingerprint';

/** The OCC `TopAbs_ShapeEnum` for an external-geometry sub-shape kind. */
function shapeEnumFor(ctx: WorkerContext, kind: SubShapeKind): any {
  const e = ctx.oc.TopAbs_ShapeEnum;
  return kind === SubShapeKind.Face ? e.TopAbs_FACE : kind === SubShapeKind.Edge ? e.TopAbs_EDGE : e.TopAbs_VERTEX;
}

/**
 * Finds a shape (face, edge, or vertex) within a solid by its tag (e.g., "face-1", "edge-5").
 * Uses indexed maps to match the UI's selection mechanism. Purely positional —
 * prefer {@link findShapeByRef}, which also honours a fingerprinted StableRef.
 */
export function findShapeByTag(ctx: WorkerContext, body: TopoDS_Shape, tag: string): TopoDS_Shape | undefined {
  return findShapeByRef(ctx, body, tag);
}

/**
 * Resolve an external-geometry reference — a legacy positional `face-N`/`edge-N`/
 * `vertex-N` string OR a fingerprinted {@link StableRef} — to the matching raw
 * sub-shape of `body`.
 *
 * A bare index resolves positionally (cheap; never fingerprints the body). A ref
 * carrying a fingerprint is re-found by *geometry*, so it survives an upstream
 * edit that renumbered the index map, and only falls back to its stored ordinal
 * index. Returns `undefined` when the ref is malformed or cannot be resolved
 * (the caller — reprojection — tolerates a miss by leaving the primitive as-is).
 */
export function findShapeByRef(ctx: WorkerContext, body: TopoDS_Shape, ref: GeometryRef): TopoDS_Shape | undefined {
  const { oc } = ctx;
  const stable = toStableRef(ref);
  if (!stable) return undefined;

  const map = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(body, shapeEnumFor(ctx, stable.kind), map);
  const extent = map.Extent();

  let idx: number;
  if (stable.fingerprint) {
    // Geometry-anchored: re-find by fingerprint, fall back to stored index.
    idx = resolveAgainst(fingerprintAll(ctx, body, stable.kind), stable);
  } else {
    idx = Number.isInteger(stable.index) && stable.index >= 0 && stable.index < extent ? stable.index : -1;
  }

  const result = idx >= 0 && idx < extent ? map.FindKey(idx + 1) : undefined;
  map.delete();
  return result;
}

/**
 * Lazily upgrade a sketch's external-geometry references to fingerprinted
 * StableRefs against `body` (where the stored positional `sourceId` indices are
 * still valid). For each external primitive lacking a captured `sourceRef`, we
 * resolve its tag to a live sub-shape and attach that sub-shape's fingerprint, so
 * every later rebuild re-finds the source by geometry even after the index map
 * renumbers. Already-captured primitives and ones whose tag no longer resolves
 * are skipped (the latter is left bare for the tolerant reprojection). Returns the
 * captured enrichments (empty when nothing new) for the main thread to persist
 * without bumping version. See `ROADMAP.md` (Deterministic topology).
 */
export function enrichSketchExternalRefs(
  ctx: WorkerContext,
  sketch: Sketch,
  body: TopoDS_Shape | null
): SketchRefEnrichment[] {
  if (!body) return [];

  // Fingerprint the body at most once per kind across all external primitives.
  const liveByKind = new Map<SubShapeKind, ReturnType<typeof fingerprintAll>>();
  const live = (kind: SubShapeKind) => {
    let l = liveByKind.get(kind);
    if (!l) { l = fingerprintAll(ctx, body, kind); liveByKind.set(kind, l); }
    return l;
  };

  const out: SketchRefEnrichment[] = [];
  for (const primitive of sketch.primitives) {
    if (!primitive.isExternal || !primitive.sourceId) continue;
    if (primitive.sourceRef?.fingerprint) continue; // already captured / converged
    const base = primitive.sourceRef ?? parseRefString(primitive.sourceId);
    if (!base) continue; // malformed tag
    const candidates = live(base.kind);
    const idx = resolveAgainst(candidates, base);
    if (idx < 0) continue; // unresolved — leave bare
    const ref: StableRef = { kind: base.kind, index: idx, fingerprint: candidates[idx] };
    out.push({ sketchId: sketch.id, primitiveId: primitive.id, ref });
  }
  return out;
}

/**
 * Projects an OpenCascade shape onto the sketch workplane.
 * Updates the planegcs primitive data with the new coordinates.
 */
export function reprojectExternalGeometry(
  ctx: WorkerContext,
  sketch: Sketch,
  body: TopoDS_Shape | null
): Sketch {
  if (!body) return sketch;
  const { oc } = ctx;

  const updatedPrimitives = sketch.primitives.map(primitive => {
    if (!primitive.isExternal || !primitive.sourceId) return primitive;

    // Prefer the geometry-anchored sourceRef (survives renumber); fall back to the
    // bare positional sourceId tag for primitives not yet captured / persisted.
    const sourceShape = findShapeByRef(ctx, body, primitive.sourceRef ?? primitive.sourceId);
    if (!sourceShape) return primitive;

    try {
      if (primitive.type === 'point' && sourceShape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_VERTEX) {
        const vertex = oc.TopoDS.Vertex_1(sourceShape);
        const pnt = oc.BRep_Tool.Pnt(vertex);
        const p2d = project({ x: pnt.X(), y: pnt.Y(), z: pnt.Z() }, sketch.workplane);
        
        pnt.delete();
        return {
          ...primitive,
          data: { ...primitive.data, x: p2d.x, y: p2d.y }
        };
      }

      if (primitive.type === 'line' && sourceShape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_EDGE) {
        const edge = oc.TopoDS.Edge_1(sourceShape);
        const first = new oc.gp_Pnt_1();
        const last = new oc.gp_Pnt_1();
        // BRep_Tool::Points on edge would be better but we can get vertices
        const v1 = oc.TopExp.FirstVertex(edge, false);
        const v2 = oc.TopExp.LastVertex(edge, false);
        
        const p1 = oc.BRep_Tool.Pnt(v1);
        const p2 = oc.BRep_Tool.Pnt(v2);
        
        const p2d_1 = project({ x: p1.X(), y: p1.Y(), z: p1.Z() }, sketch.workplane);
        const p2d_2 = project({ x: p2.X(), y: p2.Y(), z: p2.Z() }, sketch.workplane);

        p1.delete();
        p2.delete();
        first.delete();
        last.delete();
        
        // Note: In planegcs, lines might reference point IDs instead of coordinates directly.
        // If so, we'd need to update the referenced points.
        // For simplicity, we assume 'data' contains the coordinates for now if it's a stand-alone line primitive.
        return {
          ...primitive,
          data: { 
            ...primitive.data, 
            p1: { x: p2d_1.x, y: p2d_1.y }, 
            p2: { x: p2d_2.x, y: p2d_2.y } 
          }
        };
      }
    } catch (err) {
      console.warn(`[Reprojection] Failed to re-project primitive ${primitive.id}:`, err);
    }

    return primitive;
  });

  return { ...sketch, primitives: updatedPrimitives };
}
