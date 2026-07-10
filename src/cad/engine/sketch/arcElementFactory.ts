import type { Point2D, SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import { endTangentDirection, type ArcGeometry } from './arcGeometry';

/** Build an ARC sketch element from solved arc geometry (center + angle sweep). */
export function arcElementFrom(g: ArcGeometry): SketchElement {
  return {
    type: SketchElementType.ARC,
    id: crypto.randomUUID(),
    center: g.center,
    radius: g.radius,
    startAngle: g.startAngle,
    endAngle: g.endAngle,
  };
}

/**
 * Tangent direction at the end of the most recently drawn (non-construction)
 * element — the Tangent Arc tool continues from it. Falls back to +X when the
 * sketch is empty.
 */
export function lastEndTangent(elements: SketchElement[]): Point2D {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === SketchElementType.LINE && el.construction) continue;
    const dir = endTangentDirection(el as unknown as { type: string } & Record<string, any>);
    if (dir) return dir;
  }
  return { x: 1, y: 0 };
}
