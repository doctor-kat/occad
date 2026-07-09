/**
 * Composite sketch entity kind (e.g. a Center Rectangle). See `SketchGroupMembership`
 * in `SketchGroup.ts` for how children reference their owning group. See ROADMAP.md §1.1.2.
 */
export type SketchGroupType = 'center-rectangle';

/** Human-readable prefix for each group type (indexed → "Center Rectangle 1"). */
export const GROUP_LABELS: Record<SketchGroupType, string> = {
  'center-rectangle': 'Center Rectangle',
};
