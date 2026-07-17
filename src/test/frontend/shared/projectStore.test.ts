import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useProjectStore } from '@/frontend/shared/projectStore';
import { createNewProject, type Feature, type Sketch } from '@/cad/types';

function makeFeature(id: string, name: string): Feature {
  return {
    id,
    name,
    type: 'extrude-boss',
    parameters: { depth: 10 } as any,
    parentIds: [],
    isSuppressed: false,
    isVisible: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as Feature;
}

function makeSketch(id: string, name: string): Sketch {
  return {
    id,
    name,
    plane: { type: 'xy' },
    elements: [],
    primitives: [],
    isClosed: false,
    isVisible: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as unknown as Sketch;
}

describe('projectStore two-tier history', () => {
  beforeEach(() => {
    // Reset to a clean project + fresh timeline before each test.
    const project = createNewProject();
    useProjectStore.getState().dispatch({ type: 'REPLACE', project });
    useProjectStore.getState().endSketchSession();
  });

  // The store persists to localStorage via zustand — reset it so a project with
  // features/sketches can't leak into other test files that expect a fresh one.
  afterEach(() => {
    useProjectStore.getState().dispatch({ type: 'REPLACE', project: createNewProject() });
    useProjectStore.getState().endSketchSession();
    try {
      localStorage.removeItem('occad-project');
    } catch {
      /* jsdom always has localStorage; guard anyway */
    }
  });

  it('feature edits append to the persistent timeline and are undoable', () => {
    const s = () => useProjectStore.getState();
    const before = s().timeline.entries.length;

    s().dispatch({ type: 'ADD_FEATURE', feature: makeFeature('f1', 'Extrude 1') });
    expect(s().timeline.entries.length).toBe(before + 1);
    expect(s().canUndo).toBe(true);
    expect(s().project.features).toHaveLength(1);

    s().undo();
    expect(s().project.features).toHaveLength(0);
    s().redo();
    expect(s().project.features).toHaveLength(1);
  });

  it('labels the timeline entry from the action diff', () => {
    const s = () => useProjectStore.getState();
    s().dispatch({ type: 'ADD_FEATURE', feature: makeFeature('f1', 'Extrude 1') });
    s().dispatch({ type: 'UPDATE_FEATURE_PARAMETERS', featureId: 'f1', parameters: { depth: 25 } as any });

    const labels = s().timeline.entries.map((e) => e.label);
    expect(labels).toContain('Added Extrude 1');
    expect(labels.some((l) => l.includes('10') && l.includes('25'))).toBe(true);
  });

  it('in-sketch edits route to the ephemeral stack, not the timeline', () => {
    const s = () => useProjectStore.getState();
    s().dispatch({ type: 'ADD_SKETCH', sketch: makeSketch('sk1', 'Sketch 1') });
    const timelineLen = s().timeline.entries.length;

    s().beginSketchSession();
    s().dispatch({ type: 'UPDATE_SKETCH_ELEMENTS', sketchId: 'sk1', elements: [{ type: 'point', id: 'p1', x: 0, y: 0 } as any] });
    s().dispatch({ type: 'UPDATE_SKETCH_ELEMENTS', sketchId: 'sk1', elements: [{ type: 'point', id: 'p1', x: 1, y: 1 } as any] });

    // Timeline did not grow during the session; the ephemeral stack did.
    expect(s().timeline.entries.length).toBe(timelineLen);
    expect(s().canUndo).toBe(true);

    // Live undo within the session steps the sketch stack.
    s().undo();
    const el = s().project.sketches.find((sk) => sk.id === 'sk1')!.elements[0] as any;
    expect(el.x).toBe(0);
  });

  it('committing a sketch collapses the session into one timeline entry', () => {
    const s = () => useProjectStore.getState();
    s().dispatch({ type: 'ADD_SKETCH', sketch: makeSketch('sk1', 'Sketch 1') });
    const timelineLen = s().timeline.entries.length;

    s().beginSketchSession();
    s().dispatch({ type: 'UPDATE_SKETCH_ELEMENTS', sketchId: 'sk1', elements: [{ type: 'point', id: 'p1', x: 0, y: 0 } as any] });
    // Exit: STOP_SKETCH_EDIT lands as a single commit, then session closes.
    s().dispatch({ type: 'STOP_SKETCH_EDIT', sketchId: 'sk1' });
    s().endSketchSession();

    expect(s().timeline.entries.length).toBe(timelineLen + 1);
    expect(s().sketchSessionActive).toBe(false);
  });

  it('restoreVersion branch-appends and moves the marker', () => {
    const s = () => useProjectStore.getState();
    s().dispatch({ type: 'ADD_FEATURE', feature: makeFeature('f1', 'Extrude 1') });
    s().dispatch({ type: 'ADD_FEATURE', feature: makeFeature('f2', 'Extrude 2') });
    const rootId = s().timeline.entries[0].id;
    const len = s().timeline.entries.length;

    s().restoreVersion(rootId);
    // Nothing deleted; a "Restored" entry appended; project reflects the root.
    expect(s().timeline.entries.length).toBe(len + 1);
    expect(s().project.features).toHaveLength(0);
  });

  it('REPLACE starts a fresh timeline even when the new project has the same version', () => {
    const s = () => useProjectStore.getState();
    s().dispatch({ type: 'ADD_FEATURE', feature: makeFeature('f1', 'Extrude 1') });
    expect(s().timeline.entries.length).toBeGreaterThan(1);

    // A replacement project can coincidentally carry the current version number;
    // it must still not inherit the outgoing project's history.
    const incoming = { ...createNewProject(), version: s().project.version };
    s().dispatch({ type: 'REPLACE', project: incoming });

    expect(s().timeline.entries).toHaveLength(1);
    expect(s().canUndo).toBe(false);
    expect(s().project.features).toHaveLength(0);
  });

  it('clearHistory resets to a single-entry timeline', () => {
    const s = () => useProjectStore.getState();
    s().dispatch({ type: 'ADD_FEATURE', feature: makeFeature('f1', 'Extrude 1') });
    s().clearHistory();
    expect(s().timeline.entries.length).toBe(1);
    expect(s().canUndo).toBe(false);
    // Project state itself is untouched by clearing history.
    expect(s().project.features).toHaveLength(1);
  });
});
