import type { SketchElement, Point2D } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import type { ContextTarget } from '@/frontend/shared/viewportStore';

export type { ContextTarget };

export interface ContextTargetInput {
  /** Whether a sketch is being edited (faces/edges are not pickable then). */
  inSketchMode: boolean;
  // Hover (entity under the cursor right now).
  hoveredFaceId: number | null;
  hoveredEdgeIndex: number | null;
  hoveredSketchElementId: string | null;
  // Selection (used as the fallback when the click misses every entity).
  selectedFaceId: number | null;
  selectedEdgeIndex: number | null;
  selectedSketchElementIds: string[];
}

/**
 * Resolve a right-click into a {@link ContextTarget}. Pure so it can be unit
 * tested and so the resolution rules live in one place.
 *
 * Rules (in order):
 *  - Sketch mode: a hovered sketch entity wins; else the (first) selected sketch
 *    entity; else the camera menu. Solid faces/edges are dimmed and unpickable
 *    while sketching, so they are never targets here.
 *  - Otherwise: a hovered face, then a hovered edge; then fall back to a selected
 *    face, then a selected edge; else the camera menu.
 */
export function resolveContextTarget(input: ContextTargetInput): ContextTarget {
  if (input.inSketchMode) {
    if (input.hoveredSketchElementId) {
      return { kind: 'sketch-entity', elementId: input.hoveredSketchElementId };
    }
    if (input.selectedSketchElementIds.length > 0) {
      return { kind: 'sketch-entity', elementId: input.selectedSketchElementIds[0] };
    }
    return { kind: 'camera' };
  }

  if (input.hoveredFaceId !== null) return { kind: 'face', faceId: input.hoveredFaceId };
  if (input.hoveredEdgeIndex !== null) return { kind: 'edge', edgeIndex: input.hoveredEdgeIndex };
  if (input.selectedFaceId !== null) return { kind: 'face', faceId: input.selectedFaceId };
  if (input.selectedEdgeIndex !== null) return { kind: 'edge', edgeIndex: input.selectedEdgeIndex };
  return { kind: 'camera' };
}

/** Endpoints that connect a sketch element into a chain. Closed shapes
 *  (rectangle, circle, polygon) have no free endpoints, so they never extend a
 *  chain and return []. Lines and 3-point arcs expose their two ends. */
function chainEndpoints(el: SketchElement): Point2D[] {
  switch (el.type) {
    case SketchElementType.LINE:
      return [el.start, el.end];
    case SketchElementType.ARC:
      if (el.points && el.points.length === 3) return [el.points[0], el.points[2]];
      return [];
    default:
      return [];
  }
}

const CHAIN_TOL = 1e-4;
const samePoint = (a: Point2D, b: Point2D) =>
  Math.abs(a.x - b.x) < CHAIN_TOL && Math.abs(a.y - b.y) < CHAIN_TOL;

/**
 * Ids of the connected "chain" containing `startId` — every element reachable
 * from it by walking shared endpoints (SolidWorks "Select Chain"). Elements with
 * no free endpoints (circles, rectangles, polygons) form a chain of just
 * themselves. Pure; used by the sketch-entity context menu.
 */
export function computeSketchChain(elements: SketchElement[], startId: string): string[] {
  const start = elements.find((e) => e.id === startId);
  if (!start) return [];

  const startEnds = chainEndpoints(start);
  // No free endpoints → the element is its own chain.
  if (startEnds.length === 0) return [startId];

  const connectable = elements.filter((e) => chainEndpoints(e).length > 0);
  const inChain = new Set<string>([startId]);
  // Grow the frontier of open endpoints, absorbing any element that shares one.
  let frontier: Point2D[] = [...startEnds];

  let changed = true;
  while (changed) {
    changed = false;
    for (const el of connectable) {
      if (inChain.has(el.id)) continue;
      const ends = chainEndpoints(el);
      if (ends.some((e) => frontier.some((f) => samePoint(e, f)))) {
        inChain.add(el.id);
        frontier = [...frontier, ...ends];
        changed = true;
      }
    }
  }

  return elements.filter((e) => inChain.has(e.id)).map((e) => e.id);
}
