import type { SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import type { PlanegcsConstraint } from './constraintFactory';

/**
 * Auto-constraints implied by a drawn entity — the SolidWorks "sketch relations"
 * that are added automatically on creation (so a fresh rectangle behaves like a
 * rectangle, not an arbitrary quadrilateral, once its points can be dragged).
 *
 * Currently scoped to the **rectangle** tool: an axis-aligned `RECTANGLE` gets its
 * top/bottom edges Horizontal and its side edges Vertical. The four corners are
 * already coincident *by construction* — `mapElementsToPrimitives` mints four
 * edges that share corner point ids — so no explicit coincident constraints are
 * emitted (planegcs would flag them redundant).
 *
 * Targets must match the sub-primitive ids minted by `mapElementsToPrimitives`:
 *   rectangle → lines `${id}_l1` (bottom), `_l2` (right), `_l3` (top), `_l4` (left)
 *
 * Each constraint has a deterministic id (`${element.id}_auto_*`) so regenerating
 * on every element edit is idempotent (no churn), and is tagged `auto: true` so
 * callers can separate the inferred set from the user's manual constraints.
 */
export function inferAutoConstraints(elements: SketchElement[]): PlanegcsConstraint[] {
  const out: PlanegcsConstraint[] = [];

  for (const el of elements) {
    if (el.type === SketchElementType.RECTANGLE) {
      out.push(
        { id: `${el.id}_auto_h1`, type: 'horizontal_l', l_id: `${el.id}_l1`, auto: true },
        { id: `${el.id}_auto_h2`, type: 'horizontal_l', l_id: `${el.id}_l3`, auto: true },
        { id: `${el.id}_auto_v1`, type: 'vertical_l', l_id: `${el.id}_l2`, auto: true },
        { id: `${el.id}_auto_v2`, type: 'vertical_l', l_id: `${el.id}_l4`, auto: true },
      );
    }
  }

  return out;
}
