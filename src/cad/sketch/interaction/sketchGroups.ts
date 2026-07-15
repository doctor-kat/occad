import type { SketchElement } from '@/cad/types';
import { SketchElementType, GROUP_LABELS, type SketchGroupType } from '@/cad/types';

/**
 * Composite sketch-entity grouping (ROADMAP.md §1.1.2). Group membership lives on the
 * elements themselves (`groupId`/`groupType`), so every helper here derives the group
 * set purely from the flat element list — there is no separate collection to keep in
 * sync. A group's children are exactly the elements sharing its `groupId`.
 */

/** A single row in the entity list: either a standalone element or a group folder. */
export type EntityNode =
  | {
      kind: 'element';
      id: string;
      elementType: SketchElement['type'];
      label: string;
      /** True for construction geometry (dashed, excluded from the profile). */
      construction: boolean;
    }
  | {
      kind: 'group';
      groupId: string;
      groupType: SketchGroupType;
      label: string;
      childIds: string[];
      children: {
        id: string;
        elementType: SketchElement['type'];
        label: string;
        construction: boolean;
      }[];
    };

/** Human label + per-type running index, e.g. "Line 2". */
const TYPE_LABEL: Record<string, string> = {
  [SketchElementType.LINE]: 'Line',
  [SketchElementType.RECTANGLE]: 'Rectangle',
  [SketchElementType.CIRCLE]: 'Circle',
  [SketchElementType.POLYGON]: 'Polygon',
  [SketchElementType.ARC]: 'Arc',
  [SketchElementType.ELLIPSE]: 'Ellipse',
  [SketchElementType.BEZIER]: 'Spline',
  [SketchElementType.POINT]: 'Point',
};

const isConstruction = (el: SketchElement): boolean =>
  el.type === SketchElementType.LINE && Boolean((el as { construction?: boolean }).construction);

/** All element ids belonging to a group, in element order. */
export function groupChildIds(elements: SketchElement[], groupId: string): string[] {
  return elements.flatMap((el) => (el.groupId === groupId ? [el.id] : []));
}

/**
 * Expand a clicked id to the full unit it represents: if the id is a group id, or an
 * element that belongs to a group, returns every sibling's element id; otherwise just
 * `[id]`. Used so selecting/deleting any part of a composite acts on the whole group.
 */
export function expandSelection(elements: SketchElement[], id: string): string[] {
  // Direct group id?
  const asGroup = groupChildIds(elements, id);
  if (asGroup.length > 0) return asGroup;
  // Grouped element?
  const el = elements.find((e) => e.id === id);
  if (el?.groupId) return groupChildIds(elements, el.groupId);
  return [id];
}

/** True when every child of the group is present in the selection set. */
export function isGroupSelected(
  elements: SketchElement[],
  groupId: string,
  selectedIds: string[],
): boolean {
  const children = groupChildIds(elements, groupId);
  if (children.length === 0) return false;
  const set = new Set(selectedIds);
  return children.every((id) => set.has(id));
}

/**
 * Remove the whole unit an id belongs to: deleting a group id, or any grouped element,
 * drops every sibling in one step. A standalone element is removed on its own.
 */
export function removeUnit(elements: SketchElement[], id: string): SketchElement[] {
  const toRemove = new Set(expandSelection(elements, id));
  return elements.filter((el) => !toRemove.has(el.id));
}

/**
 * Build the ordered entity-list rows. Each group folds its children into one node,
 * anchored at the position of its first child; standalone elements stay inline. Labels
 * use a per-type running index (groups indexed by group type, elements by element type).
 */
export function buildEntityList(elements: SketchElement[]): EntityNode[] {
  const nodes: EntityNode[] = [];
  const typeCounts: Record<string, number> = {};
  const groupTypeCounts: Partial<Record<SketchGroupType, number>> = {};
  const emittedGroups = new Set<string>();

  const elementLabel = (el: SketchElement): string => {
    const base = TYPE_LABEL[el.type] ?? el.type;
    typeCounts[el.type] = (typeCounts[el.type] || 0) + 1;
    return `${base} ${typeCounts[el.type]}`;
  };

  for (const el of elements) {
    if (el.groupId && el.groupType) {
      if (emittedGroups.has(el.groupId)) continue;
      emittedGroups.add(el.groupId);
      const groupType = el.groupType;
      groupTypeCounts[groupType] = (groupTypeCounts[groupType] || 0) + 1;
      const label = `${GROUP_LABELS[groupType]} ${groupTypeCounts[groupType]}`;
      const members = elements.filter((m) => m.groupId === el.groupId);
      const children = members.map((m) => ({
        id: m.id,
        elementType: m.type,
        label: elementLabel(m),
        construction: isConstruction(m),
      }));
      nodes.push({
        kind: 'group',
        groupId: el.groupId,
        groupType,
        label,
        childIds: members.map((m) => m.id),
        children,
      });
    } else {
      nodes.push({
        kind: 'element',
        id: el.id,
        elementType: el.type,
        label: elementLabel(el),
        construction: isConstruction(el),
      });
    }
  }

  return nodes;
}
