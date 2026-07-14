import type { Point2D, SketchElement } from '@/cad/types';

export interface DrawToolContext {
  /** Points placed so far for the in-progress element (not yet committed). */
  points: Point2D[];
  /** The current pointer position, already grid/constraint-snapped. */
  snappedPoint: Point2D;
  /** The sketch's existing elements — read by tools that need context from
   *  prior geometry (e.g. Tangent Arc continuing off the last drawn entity). */
  sketchElements: SketchElement[];
}

export type DrawToolClickResult =
  /** Not enough points yet — keep collecting. */
  | { kind: 'continue'; points: Point2D[] }
  /** Element finished — append `elements` (may be empty, e.g. a degenerate
   *  three-point circle) to the sketch and reset for the next one. */
  | { kind: 'complete'; elements: SketchElement[] };

export interface DrawToolHandler {
  onClick(ctx: DrawToolContext): DrawToolClickResult;
  /** Live preview element while the tool is mid-placement, or null. */
  onPreview(ctx: DrawToolContext): SketchElement | null;
}
