import { describe, it, expect } from 'vitest';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import {
  buildEntityList,
  expandSelection,
  isGroupSelected,
  groupChildIds,
  removeUnit,
} from '@/cad/sketch/interaction/sketchGroups';

// A Center Rectangle group (rect + center point + 2 construction diagonals) plus a
// standalone line, to exercise mixed grouped/ungrouped lists.
const g = 'grp-1';
const elements: SketchElement[] = [
  { type: SketchElementType.LINE, id: 'solo', start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
  { type: SketchElementType.RECTANGLE, id: 'r', corner1: { x: -1, y: -1 }, corner2: { x: 1, y: 1 }, groupId: g, groupType: 'center-rectangle' },
  { type: SketchElementType.POINT, id: 'ctr', x: 0, y: 0, groupId: g, groupType: 'center-rectangle' },
  { type: SketchElementType.LINE, id: 'd1', start: { x: -1, y: -1 }, end: { x: 1, y: 1 }, construction: true, groupId: g, groupType: 'center-rectangle' },
  { type: SketchElementType.LINE, id: 'd2', start: { x: -1, y: 1 }, end: { x: 1, y: -1 }, construction: true, groupId: g, groupType: 'center-rectangle' },
] as unknown as SketchElement[];

describe('sketchGroups', () => {
  it('groupChildIds returns all members in element order', () => {
    expect(groupChildIds(elements, g)).toEqual(['r', 'ctr', 'd1', 'd2']);
    expect(groupChildIds(elements, 'missing')).toEqual([]);
  });

  it('expandSelection expands a grouped element or group id to the whole unit', () => {
    expect(expandSelection(elements, 'ctr')).toEqual(['r', 'ctr', 'd1', 'd2']);
    expect(expandSelection(elements, g)).toEqual(['r', 'ctr', 'd1', 'd2']);
    expect(expandSelection(elements, 'solo')).toEqual(['solo']);
  });

  it('isGroupSelected is true only when every child is selected', () => {
    expect(isGroupSelected(elements, g, ['r', 'ctr', 'd1', 'd2'])).toBe(true);
    expect(isGroupSelected(elements, g, ['r', 'ctr'])).toBe(false);
    expect(isGroupSelected(elements, 'missing', [])).toBe(false);
  });

  it('removeUnit drops the whole group when given any member or the group id', () => {
    expect(removeUnit(elements, 'd1').map((e) => e.id)).toEqual(['solo']);
    expect(removeUnit(elements, g).map((e) => e.id)).toEqual(['solo']);
    // A standalone element is removed on its own.
    expect(removeUnit(elements, 'solo').map((e) => e.id)).toEqual(['r', 'ctr', 'd1', 'd2']);
  });

  it('buildEntityList folds a group into one node anchored at its first child', () => {
    const nodes = buildEntityList(elements);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ kind: 'element', id: 'solo', label: 'Line 1' });
    const group = nodes[1];
    expect(group.kind).toBe('group');
    if (group.kind !== 'group') throw new Error('expected group');
    expect(group.groupType).toBe('center-rectangle');
    expect(group.label).toBe('Center Rectangle 1');
    expect(group.childIds).toEqual(['r', 'ctr', 'd1', 'd2']);
    expect(group.children.map((c) => c.label)).toEqual(['Rectangle 1', 'Point 1', 'Line 2', 'Line 3']);
    // Construction diagonals are flagged.
    expect(group.children.filter((c) => c.construction).map((c) => c.id)).toEqual(['d1', 'd2']);
  });

  it('buildEntityList indexes multiple groups of the same type', () => {
    const two: SketchElement[] = [
      { type: SketchElementType.RECTANGLE, id: 'a', corner1: { x: 0, y: 0 }, corner2: { x: 1, y: 1 }, groupId: 'g1', groupType: 'center-rectangle' },
      { type: SketchElementType.RECTANGLE, id: 'b', corner1: { x: 2, y: 2 }, corner2: { x: 3, y: 3 }, groupId: 'g2', groupType: 'center-rectangle' },
    ] as unknown as SketchElement[];
    const labels = buildEntityList(two).map((n) => n.label);
    expect(labels).toEqual(['Center Rectangle 1', 'Center Rectangle 2']);
  });
});
