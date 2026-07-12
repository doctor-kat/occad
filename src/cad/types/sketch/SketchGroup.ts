/**
 * Composite sketch entity kind (e.g. a Center Rectangle). See `SketchGroupMembership`
 * below for how children reference their owning group. See ROADMAP.md §1.1.2.
 */
export type SketchGroupType = 'center-rectangle';

/** Human-readable prefix for each group type (indexed → "Center Rectangle 1"). */
export const GROUP_LABELS: Record<SketchGroupType, string> = {
  'center-rectangle': 'Center Rectangle',
};

/**
 * Composite sketch entities (e.g. a Center Rectangle) that own a set of underlying
 * primitives so they behave as one unit in the entity list, selection, and deletion.
 *
 * Membership is stored directly on each child element (`groupId` + `groupType`) rather
 * than in a separate collection on the sketch, so children can never drift out of sync
 * with a parallel array — the group's members are always exactly the elements that
 * reference its id. See ROADMAP.md §1.1.2.
 */
export interface SketchGroupMembership {
  /** If set, this element belongs to a composite group and is selected / deleted /
   *  hovered as one unit with its siblings. */
  groupId?: string;
  /** The composite type of the owning group (drives the entity-list folder label). */
  groupType?: SketchGroupType;
}
