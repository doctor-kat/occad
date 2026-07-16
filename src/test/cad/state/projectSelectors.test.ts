import { describe, it, expect } from 'vitest';
import { buildFeatureTree, rollbackBarIndexOf } from '@/cad/state/projectSelectors';
import { projectReducer } from '@/cad/state/projectReducer';
import { makeSketch, makeFeature } from '@/cad/state/projectActions';
import { createNewProject, FeatureTreeItemType, PlaneType } from '@/cad/types';

const xy = { type: PlaneType.XY } as const;

describe('buildFeatureTree', () => {
  it('pins reference geometry at the top', () => {
    const tree = buildFeatureTree(createNewProject(), {});
    expect(tree.slice(0, 4).every((i) => i.type === FeatureTreeItemType.REFERENCE_GEOMETRY)).toBe(true);
  });

  it('shows a standalone sketch at the top level', () => {
    const sketch = makeSketch('Sketch 1', xy);
    const project = projectReducer(createNewProject(), { type: 'ADD_SKETCH', sketch });
    const tree = buildFeatureTree(project, {});
    const row = tree.find((i) => i.id === sketch.id);
    expect(row?.type).toBe(FeatureTreeItemType.SKETCH);
  });

  it('nests a consumed sketch under its owning feature', () => {
    const sketch = makeSketch('Sketch 1', xy);
    let project = projectReducer(createNewProject(), { type: 'ADD_SKETCH', sketch });
    const feature = makeFeature('Extrude 1', 'extrude-boss' as any, {} as any, sketch.id);
    project = projectReducer(project, { type: 'ADD_FEATURE', feature });
    const tree = buildFeatureTree(project, {});
    const featureRow = tree.find((i) => i.id === feature.id);
    expect(featureRow?.children?.[0].id).toBe(sketch.id);
    // sketch is not also present at top level
    expect(tree.filter((i) => i.id === sketch.id)).toHaveLength(0);
  });

  it('threads per-item errors onto the matching row', () => {
    const sketch = makeSketch('Sketch 1', xy);
    const project = projectReducer(createNewProject(), { type: 'ADD_SKETCH', sketch });
    const tree = buildFeatureTree(project, { [sketch.id]: 'boom' });
    expect(tree.find((i) => i.id === sketch.id)?.error).toBe('boom');
  });
});

describe('rollbackBarIndexOf', () => {
  it('reports the bottom (all rows) when nothing is rolled back', () => {
    let project = createNewProject();
    for (let i = 0; i < 2; i++) {
      const f = makeFeature(`F${i}`, 'extrude-boss' as any, {} as any);
      f.createdAt = 1000 + i;
      project = projectReducer(project, { type: 'ADD_FEATURE', feature: f });
    }
    expect(rollbackBarIndexOf(project)).toBe(2);
  });

  it('reflects a raised bar', () => {
    let project = createNewProject();
    for (let i = 0; i < 3; i++) {
      const f = makeFeature(`F${i}`, 'extrude-boss' as any, {} as any);
      f.createdAt = 1000 + i;
      project = projectReducer(project, { type: 'ADD_FEATURE', feature: f });
    }
    project = projectReducer(project, { type: 'MOVE_ROLLBACK_BAR', newIndex: 1 });
    expect(rollbackBarIndexOf(project)).toBe(1);
  });
});
