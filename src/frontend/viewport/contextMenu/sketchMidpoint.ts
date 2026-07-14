import type { SketchElement, SketchPoint, Point2D } from '@/cad/types';
import { SketchElementType } from '@/cad/types';

/**
 * "Select Midpoint" support. SolidWorks lets you grab the midpoint of a line as
 * a reference point to constrain or dimension against. The sketch model has no
 * standing entity for that, so this materializes one: a construction `POINT` at
 * the line's midpoint, keyed deterministically to the line so re-selecting reuses
 * it rather than piling up duplicates.
 *
 * Only straight lines have a well-defined single midpoint here (a circle/arc/
 * rectangle midpoint is ambiguous or edge-specific), so `midpointOf` returns null
 * for everything else and the menu item is disabled.
 */

/** The deterministic id of a line's midpoint reference point. */
export function midpointPointId(lineId: string): string {
  return `${lineId}_mid`;
}

/** The midpoint of a straight line, or null for any other element type. */
export function midpointOf(element: SketchElement): Point2D | null {
  if (element.type !== SketchElementType.LINE) return null;
  return { x: (element.start.x + element.end.x) / 2, y: (element.start.y + element.end.y) / 2 };
}

/**
 * Return the elements with a midpoint reference `POINT` for `lineId` present, plus
 * the id of that point (to select). Idempotent: if the point already exists it is
 * reused; if `element` has no midpoint the elements are returned unchanged and id
 * is null.
 */
export function withMidpointPoint(
  elements: SketchElement[],
  lineId: string,
): { elements: SketchElement[]; pointId: string | null } {
  const line = elements.find((e) => e.id === lineId);
  if (!line) return { elements, pointId: null };
  const mid = midpointOf(line);
  if (!mid) return { elements, pointId: null };

  const pointId = midpointPointId(lineId);
  const existing = elements.find((e) => e.id === pointId);
  if (existing) return { elements, pointId };

  const point: SketchPoint = { type: SketchElementType.POINT, id: pointId, x: mid.x, y: mid.y };
  return { elements: [...elements, point], pointId };
}
