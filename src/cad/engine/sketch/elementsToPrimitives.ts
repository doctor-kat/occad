import type { SketchElement } from '@/cad/types';

/**
 * A planegcs sketch primitive (loose shape — planegcs uses a structural union).
 * `data` carries the planegcs-specific fields (point coords, line endpoint ids, etc.).
 */
export interface SketchPrimitiveDTO {
  id: string;
  type: 'point' | 'line' | 'circle' | 'arc' | 'ellipse';
  fixed: boolean;
  data: Record<string, any>;
}

/**
 * Map legacy {@link SketchElement}s (the drawing model) to planegcs sketch primitives
 * (the solver model). Points are emitted with derived, deterministic ids so that
 * constraints can reference an element's endpoints/center:
 *   line:    `${id}_p1`, `${id}_p2`  + line `${id}`
 *   circle:  `${id}_center`          + circle `${id}`
 *   arc:     `${id}_center`          + arc `${id}`
 *   rect:    `${id}_p1..p4`          + lines `${id}_l1..l4`
 *   polygon: `${id}_p{i}`            + lines `${id}_l{i}`
 *   ellipse: `${id}_center`          + ellipse `${id}`
 */
export function mapElementsToPrimitives(elements: SketchElement[]): SketchPrimitiveDTO[] {
  const primitives: SketchPrimitiveDTO[] = [];

  elements.forEach((el) => {
    switch (el.type) {
      case 'line': {
        const p1Id = `${el.id}_p1`;
        const p2Id = `${el.id}_p2`;
        primitives.push({ id: p1Id, type: 'point', fixed: false, data: { x: el.start.x, y: el.start.y } });
        primitives.push({ id: p2Id, type: 'point', fixed: false, data: { x: el.end.x, y: el.end.y } });
        primitives.push({ id: el.id, type: 'line', fixed: false, data: { p1_id: p1Id, p2_id: p2Id } });
        break;
      }
      case 'circle': {
        const centerId = `${el.id}_center`;
        primitives.push({ id: centerId, type: 'point', fixed: false, data: { x: el.center.x, y: el.center.y } });
        // planegcs circles reference the center point via `c_id` (see gcs_wrapper.push_circle).
        primitives.push({ id: el.id, type: 'circle', fixed: false, data: { c_id: centerId, radius: el.radius } });
        break;
      }
      case 'arc': {
        const centerId = `${el.id}_center`;
        const center = el.center || { x: 0, y: 0 };
        primitives.push({ id: centerId, type: 'point', fixed: false, data: { x: center.x, y: center.y } });
        primitives.push({
          id: el.id,
          type: 'arc',
          fixed: false,
          data: {
            center_id: centerId,
            radius: el.radius || 10,
            start_angle: el.startAngle || 0,
            end_angle: el.endAngle || Math.PI / 2,
          },
        });
        break;
      }
      case 'rectangle': {
        const p1Id = `${el.id}_p1`, p2Id = `${el.id}_p2`, p3Id = `${el.id}_p3`, p4Id = `${el.id}_p4`;
        primitives.push({ id: p1Id, type: 'point', fixed: false, data: { x: el.corner1.x, y: el.corner1.y } });
        primitives.push({ id: p2Id, type: 'point', fixed: false, data: { x: el.corner2.x, y: el.corner1.y } });
        primitives.push({ id: p3Id, type: 'point', fixed: false, data: { x: el.corner2.x, y: el.corner2.y } });
        primitives.push({ id: p4Id, type: 'point', fixed: false, data: { x: el.corner1.x, y: el.corner2.y } });
        primitives.push({ id: `${el.id}_l1`, type: 'line', fixed: false, data: { p1_id: p1Id, p2_id: p2Id } });
        primitives.push({ id: `${el.id}_l2`, type: 'line', fixed: false, data: { p1_id: p2Id, p2_id: p3Id } });
        primitives.push({ id: `${el.id}_l3`, type: 'line', fixed: false, data: { p1_id: p3Id, p2_id: p4Id } });
        primitives.push({ id: `${el.id}_l4`, type: 'line', fixed: false, data: { p1_id: p4Id, p2_id: p1Id } });
        break;
      }
      case 'polygon': {
        const pointIds = el.points.map((p, i) => {
          const pid = `${el.id}_p${i}`;
          primitives.push({ id: pid, type: 'point', fixed: false, data: { x: p.x, y: p.y } });
          return pid;
        });
        pointIds.forEach((pid, i) => {
          const nextPid = pointIds[(i + 1) % pointIds.length];
          primitives.push({ id: `${el.id}_l${i}`, type: 'line', fixed: false, data: { p1_id: pid, p2_id: nextPid } });
        });
        break;
      }
      case 'ellipse': {
        const centerId = `${el.id}_center`;
        primitives.push({ id: centerId, type: 'point', fixed: false, data: { x: el.center.x, y: el.center.y } });
        primitives.push({
          id: el.id,
          type: 'ellipse',
          fixed: false,
          data: {
            center_id: centerId,
            major_radius: el.majorRadius,
            minor_radius: el.minorRadius,
            major_dir: {
              x: Math.cos((el.rotation || 0) * Math.PI / 180),
              y: Math.sin((el.rotation || 0) * Math.PI / 180),
              z: 0,
            },
          },
        });
        break;
      }
    }
  });

  return primitives;
}
