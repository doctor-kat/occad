import type { SketchElement, Point2D } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import type { SketchPrimitiveDTO } from './elementsToPrimitives';

/**
 * After the solver runs, `sketch.primitives` holds the up-to-date (possibly moved)
 * geometry, but `sketch.elements` — the legacy 2D drawing model that `SketchOverlay`
 * renders — is left exactly as it was when sent to solve. If a driving dimension
 * moves geometry, `elements` and `primitives` diverge and the overlay (which renders
 * `elements`) and `SketchRenderer` (which renders `primitives`) show two copies of
 * the same shape at different positions.
 *
 * Mirrors the id scheme minted by `mapElementsToPrimitives` in reverse: for each
 * element, look up its corresponding primitive(s) by their deterministic suffixed
 * ids and rewrite the element's coordinates from the solved data. Elements with no
 * matching primitive (e.g. construction lines, which mint no primitives at all)
 * pass through unchanged.
 */
export function syncElementsFromPrimitives(
  elements: SketchElement[],
  primitives: SketchPrimitiveDTO[]
): SketchElement[] {
  const byId = new Map(primitives.map((p) => [p.id, p]));
  const pointAt = (id: string): Point2D | null => {
    const p = byId.get(id);
    return p && typeof p.data?.x === 'number' ? { x: p.data.x, y: p.data.y } : null;
  };

  return elements.map((el) => {
    switch (el.type) {
      case SketchElementType.LINE: {
        if (el.construction) return el; // no primitives minted for construction lines
        const start = pointAt(`${el.id}_p1`);
        const end = pointAt(`${el.id}_p2`);
        return start && end ? { ...el, start, end } : el;
      }
      case SketchElementType.CIRCLE: {
        const center = pointAt(`${el.id}_center`);
        const radius = byId.get(el.id)?.data?.radius;
        return center
          ? { ...el, center, radius: typeof radius === 'number' ? radius : el.radius }
          : el;
      }
      case SketchElementType.ARC: {
        const center = pointAt(`${el.id}_center`);
        const arcData = byId.get(el.id)?.data;
        if (!center || !arcData) return el;
        return {
          ...el,
          center,
          radius: typeof arcData.radius === 'number' ? arcData.radius : el.radius,
          startAngle: typeof arcData.start_angle === 'number' ? arcData.start_angle : el.startAngle,
          endAngle: typeof arcData.end_angle === 'number' ? arcData.end_angle : el.endAngle,
        };
      }
      case SketchElementType.RECTANGLE: {
        // p1..p4 mint in order corner1, (corner2.x,corner1.y), corner2, (corner1.x,corner2.y).
        const corner1 = pointAt(`${el.id}_p1`);
        const corner2 = pointAt(`${el.id}_p3`);
        return corner1 && corner2 ? { ...el, corner1, corner2 } : el;
      }
      case SketchElementType.POLYGON: {
        const points = el.points.map((p, i) => pointAt(`${el.id}_p${i}`) ?? p);
        return { ...el, points };
      }
      case SketchElementType.ELLIPSE: {
        const center = pointAt(`${el.id}_center`);
        return center ? { ...el, center } : el;
      }
      default:
        return el;
    }
  });
}
