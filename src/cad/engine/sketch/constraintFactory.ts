/**
 * Constraint factory: converts a semantic constraint request (referencing primitive ids)
 * into a planegcs constraint object that {@link SketchSolver} can consume directly via
 * `push_primitives_and_params`.
 *
 * planegcs is the canonical constraint model in this project (`sketch.constraints: any[]`).
 * The verified planegcs type strings live in `@salusoft89/planegcs/planegcs_dist/constraints.ts`.
 */

// ConstraintKind/ConstraintInput are UI-facing DTOs, so they live in src/cad/types
// (the only layer other layers may import from) rather than here in the engine.
export type { ConstraintKind, ConstraintInput } from '@/cad/types';
import type { ConstraintKind, ConstraintInput } from '@/cad/types';

/** A planegcs constraint object (loose — planegcs uses a structural union). */
export type PlanegcsConstraint = Record<string, any> & { id: string; type: string };

/**
 * Build a planegcs constraint object from a semantic request.
 * @param id   Unique id for the constraint (caller-supplied for determinism).
 * @param input The constraint request.
 */
export function createConstraint(id: string, input: ConstraintInput): PlanegcsConstraint {
  switch (input.kind) {
    case 'horizontal':
      return { id, type: 'horizontal_l', l_id: input.lineId };

    case 'vertical':
      return { id, type: 'vertical_l', l_id: input.lineId };

    case 'coincident':
      return { id, type: 'p2p_coincident', p1_id: input.p1Id, p2_id: input.p2Id };

    case 'parallel':
      return { id, type: 'parallel', l1_id: input.l1Id, l2_id: input.l2Id };

    case 'perpendicular':
      return { id, type: 'perpendicular_ll', l1_id: input.l1Id, l2_id: input.l2Id };

    case 'distance':
      return { id, type: 'p2p_distance', p1_id: input.p1Id, p2_id: input.p2Id, distance: input.distance, driving: true };

    case 'horizontal-distance':
      return {
        id,
        type: 'difference',
        param1: { o_id: input.p1Id, prop: 'x' },
        param2: { o_id: input.p2Id, prop: 'x' },
        difference: input.distance,
        driving: true,
      };

    case 'vertical-distance':
      return {
        id,
        type: 'difference',
        param1: { o_id: input.p1Id, prop: 'y' },
        param2: { o_id: input.p2Id, prop: 'y' },
        difference: input.distance,
        driving: true,
      };

    case 'point-line-distance':
      return { id, type: 'p2l_distance', p_id: input.pointId, l_id: input.lineId, distance: input.distance, driving: true };

    case 'radius':
      return input.isArc
        ? { id, type: 'arc_radius', a_id: input.targetId, radius: input.radius, driving: true }
        : { id, type: 'circle_radius', c_id: input.targetId, radius: input.radius, driving: true };

    case 'equal':
      return { id, type: 'equal_length', l1_id: input.l1Id, l2_id: input.l2Id };

    case 'tangent':
      return { id, type: 'tangent_lc', l_id: input.lineId, c_id: input.circleId };

    case 'angle':
      return { id, type: 'l2l_angle_ll', l1_id: input.l1Id, l2_id: input.l2Id, angle: input.angle, driving: true };

    default: {
      // Exhaustiveness guard
      const _never: never = input;
      throw new Error(`Unknown constraint kind: ${JSON.stringify(_never)}`);
    }
  }
}

/** Number of entities a constraint kind expects (for UI selection validation). */
export const CONSTRAINT_ARITY: Record<ConstraintKind, number> = {
  horizontal: 1,
  vertical: 1,
  coincident: 2,
  parallel: 2,
  perpendicular: 2,
  distance: 2,
  'horizontal-distance': 2,
  'vertical-distance': 2,
  'point-line-distance': 2,
  radius: 1,
  equal: 2,
  tangent: 2,
  angle: 2,
};
