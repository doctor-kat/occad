import { describe, it, expect } from 'vitest';
import { projectReducer } from '@/cad/state/projectReducer';
import { makeSketch, makeFeature } from '@/cad/state/projectActions';
import { createNewProject, compareBuildOrder, PlaneType } from '@/cad/types';
import { SketchElementType } from '@/cad/types/sketch/sketchElements';
import type { SketchElement } from '@/cad/types/sketch/SketchElement';

const xy = { type: PlaneType.XY } as const;

function projectWithSketch(name = 'Sketch 1') {
  const sketch = makeSketch(name, xy);
  const project = projectReducer(createNewProject(), { type: 'ADD_SKETCH', sketch });
  return { project, sketch };
}

const lineLoop: SketchElement[] = [
  { id: 'l1', type: SketchElementType.LINE, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as any,
  { id: 'l2', type: SketchElementType.LINE, start: { x: 1, y: 0 }, end: { x: 1, y: 1 } } as any,
  { id: 'l3', type: SketchElementType.LINE, start: { x: 1, y: 1 }, end: { x: 0, y: 0 } } as any,
];

describe('projectReducer — sketches', () => {
  it('ADD_SKETCH appends the sketch and bumps version', () => {
    const start = createNewProject();
    const sketch = makeSketch('Sketch 1', xy);
    const next = projectReducer(start, { type: 'ADD_SKETCH', sketch });
    expect(next.sketches).toHaveLength(1);
    expect(next.sketches[0].id).toBe(sketch.id);
    expect(next.version).toBe(start.version + 1);
  });

  it('UPDATE_SKETCH_ELEMENTS sets elements, derives isClosed, bumps version', () => {
    const { project, sketch } = projectWithSketch();
    const next = projectReducer(project, { type: 'UPDATE_SKETCH_ELEMENTS', sketchId: sketch.id, elements: lineLoop });
    expect(next.sketches[0].elements).toHaveLength(3);
    expect(next.sketches[0].isClosed).toBe(true);
    expect(next.version).toBe(project.version + 1);
  });

  it('UPDATE_SKETCH_ELEMENTS on an unknown sketch is a no-op (same reference)', () => {
    const { project } = projectWithSketch();
    const next = projectReducer(project, { type: 'UPDATE_SKETCH_ELEMENTS', sketchId: 'nope', elements: lineLoop });
    expect(next).toBe(project);
  });

  it('UPDATE_SKETCH_GEOMETRY does NOT bump version (derived data)', () => {
    const { project, sketch } = projectWithSketch();
    const next = projectReducer(project, { type: 'UPDATE_SKETCH_GEOMETRY', sketchId: sketch.id, geometry: { shapeId: 's1' } as any });
    expect(next.sketches[0].geometry).toEqual({ shapeId: 's1' });
    expect(next.version).toBe(project.version);
  });

  it('DELETE_SKETCH removes the sketch and bumps version', () => {
    const { project, sketch } = projectWithSketch();
    const next = projectReducer(project, { type: 'DELETE_SKETCH', sketchId: sketch.id });
    expect(next.sketches).toHaveLength(0);
    expect(next.version).toBe(project.version + 1);
  });

  it('STOP_SKETCH_EDIT deletes an empty sketch', () => {
    const { project, sketch } = projectWithSketch();
    const next = projectReducer(project, { type: 'STOP_SKETCH_EDIT', sketchId: sketch.id });
    expect(next.sketches).toHaveLength(0);
    expect(next.version).toBe(project.version + 1);
  });

  it('STOP_SKETCH_EDIT keeps a non-empty sketch but still bumps version', () => {
    const { project, sketch } = projectWithSketch();
    const withEls = projectReducer(project, { type: 'UPDATE_SKETCH_ELEMENTS', sketchId: sketch.id, elements: lineLoop });
    const next = projectReducer(withEls, { type: 'STOP_SKETCH_EDIT', sketchId: sketch.id });
    expect(next.sketches).toHaveLength(1);
    expect(next.version).toBe(withEls.version + 1);
  });
});

describe('projectReducer — features', () => {
  it('ADD_FEATURE appends and auto-hides the consumed sketch', () => {
    const { project, sketch } = projectWithSketch();
    const feature = makeFeature('Extrude 1', 'extrude-boss' as any, {} as any, sketch.id);
    const next = projectReducer(project, { type: 'ADD_FEATURE', feature });
    expect(next.features).toHaveLength(1);
    expect(next.sketches.find((s) => s.id === sketch.id)!.isVisible).toBe(false);
    expect(next.version).toBe(project.version + 1);
  });

  it('TOGGLE_FEATURE_SUPPRESSION flips isSuppressed and bumps version', () => {
    const { project, sketch } = projectWithSketch();
    const feature = makeFeature('Extrude 1', 'extrude-boss' as any, {} as any, sketch.id);
    const withFeature = projectReducer(project, { type: 'ADD_FEATURE', feature });
    const next = projectReducer(withFeature, { type: 'TOGGLE_FEATURE_SUPPRESSION', featureId: feature.id });
    expect(next.features[0].isSuppressed).toBe(true);
    expect(next.version).toBe(withFeature.version + 1);
  });

  it('TOGGLE_FEATURE_VISIBILITY flips isVisible WITHOUT bumping version', () => {
    const { project, sketch } = projectWithSketch();
    const feature = makeFeature('Extrude 1', 'extrude-boss' as any, {} as any, sketch.id);
    const withFeature = projectReducer(project, { type: 'ADD_FEATURE', feature });
    const next = projectReducer(withFeature, { type: 'TOGGLE_FEATURE_VISIBILITY', featureId: feature.id });
    expect(next.features[0].isVisible).toBe(false);
    expect(next.version).toBe(withFeature.version);
  });

  it('DELETE_FEATURE removes the feature and bumps version', () => {
    const { project, sketch } = projectWithSketch();
    const feature = makeFeature('Extrude 1', 'extrude-boss' as any, {} as any, sketch.id);
    const withFeature = projectReducer(project, { type: 'ADD_FEATURE', feature });
    const next = projectReducer(withFeature, { type: 'DELETE_FEATURE', featureId: feature.id });
    expect(next.features).toHaveLength(0);
    expect(next.version).toBe(withFeature.version + 1);
  });
});

describe('projectReducer — enrichments do not loop the rebuild', () => {
  it('APPLY_REF_ENRICHMENTS merges refs without bumping version', () => {
    const start = createNewProject();
    const feature = makeFeature('Fillet 1', 'fillet' as any, { edges: [] } as any);
    const withFeature = projectReducer(start, { type: 'ADD_FEATURE', feature });
    const next = projectReducer(withFeature, {
      type: 'APPLY_REF_ENRICHMENTS',
      enrichments: [{ featureId: feature.id, key: 'edges', refs: [{ fp: 'x' }] } as any],
    });
    expect((next.features[0].parameters as any).edges).toEqual([{ fp: 'x' }]);
    expect(next.version).toBe(withFeature.version);
  });

  it('APPLY_REF_ENRICHMENTS with nothing applicable returns the same reference', () => {
    const start = createNewProject();
    const next = projectReducer(start, { type: 'APPLY_REF_ENRICHMENTS', enrichments: [] });
    expect(next).toBe(start);
  });
});

describe('projectReducer — reorder & rollback', () => {
  function threeFeatures() {
    let project = createNewProject();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const f = makeFeature(`F${i}`, 'extrude-boss' as any, {} as any);
      // force distinct, increasing createdAt so build order is deterministic
      f.createdAt = 1000 + i;
      project = projectReducer(project, { type: 'ADD_FEATURE', feature: f });
      ids.push(f.id);
    }
    return { project, ids };
  }

  it('REORDER_FEATURE moves a feature to the front in build order', () => {
    const { project, ids } = threeFeatures();
    const next = projectReducer(project, { type: 'REORDER_FEATURE', featureId: ids[2], newIndex: 0 });
    const order = [...next.features].sort(compareBuildOrder).map((f) => f.id);
    expect(order[0]).toBe(ids[2]);
    expect(next.version).toBe(project.version + 1);
  });

  it('MOVE_ROLLBACK_BAR sets a threshold and bumps version', () => {
    const { project } = threeFeatures();
    const next = projectReducer(project, { type: 'MOVE_ROLLBACK_BAR', newIndex: 1 });
    expect(next.rollbackBar).not.toBeUndefined();
    expect(next.version).toBe(project.version + 1);
  });

  it('a feature added while rolled back is slotted at the bar (present), not past it', () => {
    const { project } = threeFeatures();
    const rolled = projectReducer(project, { type: 'MOVE_ROLLBACK_BAR', newIndex: 1 });
    const f = makeFeature('New', 'extrude-boss' as any, {} as any);
    const next = projectReducer(rolled, { type: 'ADD_FEATURE', feature: f });
    const added = next.features.find((x) => x.id === f.id)!;
    // sequenceAtBar assigns a key at/under the bar so the new feature stays present
    expect(added.sequence).toBeLessThanOrEqual(rolled.rollbackBar!);
  });
});

describe('projectReducer — tree ops', () => {
  it('DELETE_TREE_ITEM deletes a sketch by id and bumps version', () => {
    const { project, sketch } = projectWithSketch();
    const next = projectReducer(project, { type: 'DELETE_TREE_ITEM', id: sketch.id });
    expect(next.sketches).toHaveLength(0);
    expect(next.version).toBe(project.version + 1);
  });

  it('DELETE_TREE_ITEM on reference geometry is a no-op', () => {
    const start = createNewProject();
    const refId = start.referenceGeometry[0].id;
    const next = projectReducer(start, { type: 'DELETE_TREE_ITEM', id: refId });
    expect(next).toBe(start);
  });

  it('TOGGLE_TREE_ITEM_VISIBILITY flips a sketch without bumping version', () => {
    const { project, sketch } = projectWithSketch();
    const before = project.sketches[0].isVisible;
    const next = projectReducer(project, { type: 'TOGGLE_TREE_ITEM_VISIBILITY', id: sketch.id });
    expect(next.sketches[0].isVisible).toBe(!before);
    expect(next.version).toBe(project.version);
  });
});

describe('projectReducer — whole-project actions', () => {
  it('REPLACE swaps the project wholesale', () => {
    const { project } = projectWithSketch();
    const fresh = createNewProject();
    expect(projectReducer(project, { type: 'REPLACE', project: fresh })).toBe(fresh);
  });

  it('TOUCH bumps updatedAt but not version', () => {
    const start = createNewProject();
    const next = projectReducer(start, { type: 'TOUCH' });
    expect(next.version).toBe(start.version);
    expect(next.updatedAt).toBeGreaterThanOrEqual(start.updatedAt);
  });
});
