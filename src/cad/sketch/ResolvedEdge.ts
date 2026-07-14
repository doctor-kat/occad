import type { Point2D } from '@/cad/types';

export interface ResolvedEdge {
  dir: Point2D;
  mid: Point2D;
  /** Center of the multi-edge shape this edge belongs to, for picking the
   *  outward-facing perpendicular (rectangles/polygons have edges running in
   *  all directions, so "rotate 90°" alone can point inward). Undefined for a
   *  standalone line, where either side is equally valid. */
  shapeCenter?: Point2D;
}
