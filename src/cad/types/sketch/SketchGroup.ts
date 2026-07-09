/**
 * Composite sketch entities (e.g. a Center Rectangle) that own a set of underlying
 * primitives so they behave as one unit in the entity list, selection, and deletion.
 *
 * Membership is stored directly on each child element (`groupId` + `groupType`) rather
 * than in a separate collection on the sketch, so children can never drift out of sync
 * with a parallel array — the group's members are always exactly the elements that
 * reference its id. See ROADMAP.md §1.1.2.
 */
import type { SketchGroupType } from './SketchGroupType';

export interface SketchGroupMembership {
  /** If set, this element belongs to a composite group and is selected / deleted /
   *  hovered as one unit with its siblings. */
  groupId?: string;
  /** The composite type of the owning group (drives the entity-list folder label). */
  groupType?: SketchGroupType;
}
