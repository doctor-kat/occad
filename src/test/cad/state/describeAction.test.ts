import { describe, it, expect } from 'vitest';
import { describeAction } from '@/cad/state/describeAction';
import { ProjectAction } from '@/cad/state/projectReducer';
import type { CADProject, Feature, Sketch } from '@/cad/types';

function makeProject(overrides: Partial<CADProject> = {}): CADProject {
  return {
    id: 'proj-1',
    name: 'Project',
    createdAt: 0,
    updatedAt: 0,
    version: 1,
    referenceGeometry: [],
    sketches: [],
    features: [],
    ...overrides,
  } as CADProject;
}

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: 'feat-1',
    name: 'Extrude 1',
    type: 'extrude-boss',
    parentIds: [],
    isSuppressed: false,
    isVisible: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as Feature;
}

function makeSketch(overrides: Partial<Sketch> = {}): Sketch {
  return {
    id: 'sketch-1',
    name: 'Sketch 1',
    plane: { type: 'xy' },
    elements: [],
    primitives: [],
    isClosed: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as unknown as Sketch;
}

describe('describeAction', () => {
  it('REPLACE -> "Restored project"', () => {
    const prev = makeProject();
    const next = makeProject();
    expect(describeAction({ type: 'REPLACE', project: next }, prev, next)).toBe('Restored project');
  });

  it('TOUCH -> "Saved"', () => {
    const prev = makeProject();
    expect(describeAction({ type: 'TOUCH' }, prev, prev)).toBe('Saved');
  });

  it('ADD_SKETCH -> "Created <name>"', () => {
    const prev = makeProject();
    const sketch = makeSketch({ name: 'Sketch 2' });
    const next = makeProject({ sketches: [sketch] });
    const action: ProjectAction = { type: 'ADD_SKETCH', sketch };
    expect(describeAction(action, prev, next)).toBe('Created Sketch 2');
  });

  it('UPDATE_SKETCH_ELEMENTS -> "Edited <name>"', () => {
    const sketch = makeSketch({ name: 'Sketch 1' });
    const prev = makeProject({ sketches: [sketch] });
    const next = makeProject({ sketches: [sketch] });
    const action: ProjectAction = { type: 'UPDATE_SKETCH_ELEMENTS', sketchId: sketch.id, elements: [] };
    expect(describeAction(action, prev, next)).toBe('Edited Sketch 1');
  });

  it('STOP_SKETCH_EDIT -> "Edited <name>"', () => {
    const sketch = makeSketch({ name: 'Sketch 3' });
    const prev = makeProject({ sketches: [sketch] });
    const next = makeProject({ sketches: [sketch] });
    const action: ProjectAction = { type: 'STOP_SKETCH_EDIT', sketchId: sketch.id };
    expect(describeAction(action, prev, next)).toBe('Edited Sketch 3');
  });

  it('DELETE_SKETCH -> "Deleted <name>" (looked up in prev)', () => {
    const sketch = makeSketch({ name: 'Sketch 4' });
    const prev = makeProject({ sketches: [sketch] });
    const next = makeProject({ sketches: [] });
    const action: ProjectAction = { type: 'DELETE_SKETCH', sketchId: sketch.id };
    expect(describeAction(action, prev, next)).toBe('Deleted Sketch 4');
  });

  it('ADD_CONSTRAINT -> "Added constraint to <sketch>"', () => {
    const sketch = makeSketch({ name: 'Sketch 5' });
    const prev = makeProject({ sketches: [sketch] });
    const action: ProjectAction = {
      type: 'ADD_CONSTRAINT',
      sketchId: sketch.id,
      constraint: { id: 'c1' } as any,
    };
    expect(describeAction(action, prev, prev)).toBe('Added constraint to Sketch 5');
  });

  it('REMOVE_CONSTRAINT -> "Removed constraint from <sketch>"', () => {
    const sketch = makeSketch({ name: 'Sketch 6' });
    const prev = makeProject({ sketches: [sketch] });
    const action: ProjectAction = { type: 'REMOVE_CONSTRAINT', sketchId: sketch.id, constraintId: 'c1' };
    expect(describeAction(action, prev, prev)).toBe('Removed constraint from Sketch 6');
  });

  it('ADD_FEATURE -> "Added <name>"', () => {
    const prev = makeProject();
    const feature = makeFeature({ name: 'Extrude 1' });
    const next = makeProject({ features: [feature] });
    const action: ProjectAction = { type: 'ADD_FEATURE', feature };
    expect(describeAction(action, prev, next)).toBe('Added Extrude 1');
  });

  it('UPDATE_FEATURE_PARAMETERS -> diffs numeric params', () => {
    const feature = makeFeature({ name: 'Extrude 1', parameters: { depth: 10, unit: 'mm' } as any });
    const prev = makeProject({ features: [feature] });
    const nextFeature = { ...feature, parameters: { depth: 20, unit: 'mm' } as any };
    const next = makeProject({ features: [nextFeature] });
    const action: ProjectAction = {
      type: 'UPDATE_FEATURE_PARAMETERS',
      featureId: feature.id,
      parameters: nextFeature.parameters,
    };
    expect(describeAction(action, prev, next)).toBe('Extrude 1: depth 10 → 20 mm');
  });

  it('UPDATE_FEATURE_PARAMETERS -> falls back to "Edited <name>" when nothing numeric changed', () => {
    const feature = makeFeature({ name: 'Fillet 1', parameters: { radius: 5 } as any });
    const prev = makeProject({ features: [feature] });
    const next = makeProject({ features: [feature] });
    const action: ProjectAction = {
      type: 'UPDATE_FEATURE_PARAMETERS',
      featureId: feature.id,
      parameters: feature.parameters as any,
    };
    expect(describeAction(action, prev, next)).toBe('Edited Fillet 1');
  });

  it('UPDATE_FEATURE_PARAMETERS -> falls back defensively on odd/missing param shapes', () => {
    const feature = makeFeature({ name: 'Weird Op', parameters: undefined });
    const prev = makeProject({ features: [feature] });
    const next = makeProject({ features: [feature] });
    const action: ProjectAction = {
      type: 'UPDATE_FEATURE_PARAMETERS',
      featureId: feature.id,
      parameters: 'not-an-object' as any,
    };
    expect(describeAction(action, prev, next)).toBe('Edited Weird Op');
  });

  it('REORDER_FEATURE -> "Reordered <name>"', () => {
    const feature = makeFeature({ name: 'Chamfer 1' });
    const prev = makeProject({ features: [feature] });
    const action: ProjectAction = { type: 'REORDER_FEATURE', featureId: feature.id, newIndex: 0 };
    expect(describeAction(action, prev, prev)).toBe('Reordered Chamfer 1');
  });

  it('TOGGLE_FEATURE_SUPPRESSION -> "Suppressed <name>" when next is suppressed', () => {
    const feature = makeFeature({ name: 'Shell 1', isSuppressed: false });
    const prev = makeProject({ features: [feature] });
    const nextFeature = { ...feature, isSuppressed: true };
    const next = makeProject({ features: [nextFeature] });
    const action: ProjectAction = { type: 'TOGGLE_FEATURE_SUPPRESSION', featureId: feature.id };
    expect(describeAction(action, prev, next)).toBe('Suppressed Shell 1');
  });

  it('TOGGLE_FEATURE_SUPPRESSION -> "Unsuppressed <name>" when next is not suppressed', () => {
    const feature = makeFeature({ name: 'Shell 2', isSuppressed: true });
    const prev = makeProject({ features: [feature] });
    const nextFeature = { ...feature, isSuppressed: false };
    const next = makeProject({ features: [nextFeature] });
    const action: ProjectAction = { type: 'TOGGLE_FEATURE_SUPPRESSION', featureId: feature.id };
    expect(describeAction(action, prev, next)).toBe('Unsuppressed Shell 2');
  });

  it('TOGGLE_FEATURE_VISIBILITY -> "Hid <name>" when next is hidden', () => {
    const feature = makeFeature({ name: 'Box 1', isVisible: true });
    const prev = makeProject({ features: [feature] });
    const nextFeature = { ...feature, isVisible: false };
    const next = makeProject({ features: [nextFeature] });
    const action: ProjectAction = { type: 'TOGGLE_FEATURE_VISIBILITY', featureId: feature.id };
    expect(describeAction(action, prev, next)).toBe('Hid Box 1');
  });

  it('TOGGLE_FEATURE_VISIBILITY -> "Showed <name>" when next is visible', () => {
    const feature = makeFeature({ name: 'Box 2', isVisible: false });
    const prev = makeProject({ features: [feature] });
    const nextFeature = { ...feature, isVisible: true };
    const next = makeProject({ features: [nextFeature] });
    const action: ProjectAction = { type: 'TOGGLE_FEATURE_VISIBILITY', featureId: feature.id };
    expect(describeAction(action, prev, next)).toBe('Showed Box 2');
  });

  it('DELETE_FEATURE -> "Deleted <name>" (looked up in prev)', () => {
    const feature = makeFeature({ name: 'Fillet 2' });
    const prev = makeProject({ features: [feature] });
    const next = makeProject({ features: [] });
    const action: ProjectAction = { type: 'DELETE_FEATURE', featureId: feature.id };
    expect(describeAction(action, prev, next)).toBe('Deleted Fillet 2');
  });

  it('MOVE_ROLLBACK_BAR -> "Moved history bar"', () => {
    const prev = makeProject();
    const action: ProjectAction = { type: 'MOVE_ROLLBACK_BAR', newIndex: 1 };
    expect(describeAction(action, prev, prev)).toBe('Moved history bar');
  });

  it('derived/enrichment/geometry actions -> ""', () => {
    const prev = makeProject();
    expect(describeAction({ type: 'APPLY_REF_ENRICHMENTS', enrichments: [] }, prev, prev)).toBe('');
    expect(describeAction({ type: 'APPLY_SKETCH_REF_ENRICHMENTS', enrichments: [] }, prev, prev)).toBe('');
    expect(
      describeAction(
        { type: 'UPDATE_FEATURE_GEOMETRY', featureId: 'x', geometry: {} as any },
        prev,
        prev
      )
    ).toBe('');
    expect(
      describeAction(
        { type: 'UPDATE_SKETCH_GEOMETRY', sketchId: 'x', geometry: {} as any },
        prev,
        prev
      )
    ).toBe('');
  });

  it('unhandled/unknown action type -> "" defensively (never throws)', () => {
    const prev = makeProject();
    const bogus = { type: 'SOME_UNKNOWN_ACTION' } as unknown as ProjectAction;
    expect(() => describeAction(bogus, prev, prev)).not.toThrow();
    expect(describeAction(bogus, prev, prev)).toBe('');
  });

  it('missing entity lookups fall back to generic name without throwing', () => {
    const prev = makeProject();
    const action: ProjectAction = { type: 'DELETE_FEATURE', featureId: 'missing-id' };
    expect(() => describeAction(action, prev, prev)).not.toThrow();
    expect(describeAction(action, prev, prev)).toBe('Deleted Feature');
  });
});
