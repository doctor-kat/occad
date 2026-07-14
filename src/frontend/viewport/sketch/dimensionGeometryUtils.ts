import { Point2D } from '@/cad/types';

export const DEFAULT_LABEL_DISTANCE = 10;

/** planegcs uses `c_id` for a circle/arc center; unsolved data may use `center_id`. */
export const centerPointId = (data: any): string | undefined => data.c_id ?? data.center_id;

/** Unit vector perpendicular to a->b, or straight up for a degenerate (zero-length)
 *  segment. Used as the default dimension-label direction so it offsets to the side
 *  of a vertical line instead of further along it (matching constraint badge placement). */
export function perpUnit(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  return l === 0 ? { x: 0, y: 1 } : { x: -dy / l, y: dx / l };
}
