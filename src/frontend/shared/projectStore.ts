import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { CADProject, createNewProject } from '@/cad/types';
import { projectReducer, type ProjectAction } from '@/cad/state/projectReducer';
import { migrateProject } from '@/cad/state/projectHelpers';
import { describeAction } from '@/cad/state/describeAction';
import {
  History,
  emptyHistory,
  record,
  canUndo as histCanUndo,
  canRedo as histCanRedo,
  undo as histUndo,
  redo as histRedo,
} from '@/cad/state/history';
import {
  Timeline,
  createTimeline,
  append as tlAppend,
  restore as tlRestore,
  stepBack as tlStepBack,
  stepForward as tlStepForward,
  canStepBack,
  canStepForward,
  current as tlCurrent,
} from '@/cad/state/versionTimeline';
import {
  loadTimeline,
  saveTimeline,
  createDebouncedSaver,
  deleteTimeline,
} from '@/frontend/shared/versionStorage';

const STORAGE_KEY = 'occad-project';

/**
 * Which history tier an action belongs to.
 *
 * - `sketch`  — an in-progress sketch edit. While a sketch session is active
 *   these route to the ephemeral Tier-2 stack (live undo/redo) instead of the
 *   persistent Tier-1 timeline, and collapse into a single timeline entry when
 *   the sketch is committed (`STOP_SKETCH_EDIT`, which is itself `model`).
 * - `model`   — a feature-level milestone; appends to the Tier-1 timeline.
 * - `derived` — never historic (rebuild enrichments, pure UI toggles). These
 *   don't bump `version`, so they're filtered out before the tier is consulted;
 *   the entry documents the intent and keeps this map exhaustive.
 */
type HistoryTier = 'sketch' | 'model' | 'derived';

/**
 * Exhaustive by construction: this is a `Record` over the action union rather
 * than a list of "special" types, so adding a `ProjectAction` fails to compile
 * until its tier is chosen. A missing entry would otherwise silently land a
 * timeline entry per sketch drag frame.
 */
const ACTION_TIER: Record<ProjectAction['type'], HistoryTier> = {
  UPDATE_SKETCH_ELEMENTS: 'sketch',
  UPDATE_SKETCH_STATE: 'sketch',
  ADD_CONSTRAINT: 'sketch',
  REMOVE_CONSTRAINT: 'sketch',

  ADD_SKETCH: 'model',
  DELETE_SKETCH: 'model',
  STOP_SKETCH_EDIT: 'model',
  ADD_FEATURE: 'model',
  DELETE_FEATURE: 'model',
  DELETE_TREE_ITEM: 'model',
  UPDATE_FEATURE_PARAMETERS: 'model',
  TOGGLE_FEATURE_SUPPRESSION: 'model',
  TOGGLE_FEATURE_VISIBILITY: 'model',
  REORDER_FEATURE: 'model',
  MOVE_ROLLBACK_BAR: 'model',
  REPLACE: 'model',
  TOUCH: 'model',

  UPDATE_SKETCH_GEOMETRY: 'derived',
  UPDATE_FEATURE_GEOMETRY: 'derived',
  APPLY_REF_ENRICHMENTS: 'derived',
  APPLY_SKETCH_REF_ENRICHMENTS: 'derived',
  TOGGLE_TREE_ITEM_EXPANSION: 'derived',
  TOGGLE_TREE_ITEM_VISIBILITY: 'derived',
};

export interface ProjectStore {
  /** The durable, migrated project. The single source of truth for model state. */
  project: CADProject;
  /** Tier 1: persistent, branch-appending version timeline (Google-Docs style). */
  timeline: Timeline<CADProject>;
  /** Tier 2: ephemeral in-sketch undo/redo, cleared when the sketch is exited. */
  sketchHistory: History<CADProject>;
  /** True while a sketch is open for editing (routes edits to Tier 2). */
  sketchSessionActive: boolean;
  /** Context-aware: reflects the sketch stack in a session, else the timeline. */
  canUndo: boolean;
  canRedo: boolean;
  /** Apply a model mutation. Version-changing edits record history (per tier). */
  dispatch: (action: ProjectAction) => void;
  undo: () => void;
  redo: () => void;
  /** Jump the timeline to a version (branch-appends). Ignores in-sketch state. */
  restoreVersion: (id: string) => void;
  /** Clear the version history and start a fresh timeline from the current project. */
  clearHistory: () => Promise<void>;
  /** Begin/end an in-sketch editing session (Tier 2 lifecycle). */
  beginSketchSession: () => void;
  endSketchSession: () => void;
  /** Load the persisted timeline for the current project from IndexedDB. */
  hydrateTimeline: () => Promise<void>;
}

const saveTimelineDebounced = createDebouncedSaver();

/**
 * Storage tolerant of the pre-zustand format: the old useLocalStorage put a bare
 * CADProject under `occad-project`, whereas persist expects a `{ state, version }`
 * envelope. On read we detect a legacy bare project and wrap it so existing local
 * work survives the migration.
 */
const migrationTolerantStorage: StateStorage = {
  getItem: (name) => {
    const raw = localStorage.getItem(name);
    if (raw == null) return null;
    try {
      const parsed = JSON.parse(raw);
      // A persist envelope has a `state` object; a legacy value is a bare project.
      if (parsed && typeof parsed === 'object' && 'state' in parsed) return raw;
      // Legacy bare CADProject → wrap as an envelope containing { project }.
      return JSON.stringify({ state: { project: parsed }, version: 0 });
    } catch {
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
};

const initialProject = createNewProject();

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      project: initialProject,
      timeline: createTimeline<CADProject>(initialProject, 'Initial version'),
      sketchHistory: emptyHistory<CADProject>(),
      sketchSessionActive: false,
      canUndo: false,
      canRedo: false,

      dispatch: (action) =>
        set((s) => {
          const next = projectReducer(s.project, action);
          if (next === s.project) return {}; // reducer no-op

          // REPLACE (new project / import) starts a fresh timeline — a new or
          // imported project must never inherit the previous project's history.
          // This is checked before the version guard below: a replacement project
          // can coincidentally carry the same `version` as the outgoing one.
          if (action.type === 'REPLACE') {
            const timeline = createTimeline<CADProject>(next, describeAction(action, s.project, next) || 'Imported project');
            saveTimelineDebounced(next.id, timeline);
            return { project: next, timeline, sketchHistory: emptyHistory<CADProject>(), canUndo: false, canRedo: false };
          }

          // Non-model edits (derived enrichments, pure UI toggles) keep `version`;
          // they stay out of history entirely.
          if (next.version === s.project.version) return { project: next };

          // In-sketch edits feed the ephemeral Tier-2 stack only.
          if (s.sketchSessionActive && ACTION_TIER[action.type] === 'sketch') {
            const sketchHistory = record(s.sketchHistory, s.project);
            return { project: next, sketchHistory, canUndo: histCanUndo(sketchHistory), canRedo: histCanRedo(sketchHistory) };
          }

          // Everything else is a feature-level milestone → persistent timeline.
          const label = describeAction(action, s.project, next) || 'Edited model';
          const timeline = tlAppend(s.timeline, next, label);
          saveTimelineDebounced(next.id, timeline);
          return { project: next, timeline, canUndo: canStepBack(timeline), canRedo: canStepForward(timeline) };
        }),

      undo: () =>
        set((s) => {
          if (s.sketchSessionActive) {
            const res = histUndo(s.sketchHistory, s.project);
            if (!res) return {};
            return {
              project: res.state,
              sketchHistory: res.history,
              canUndo: histCanUndo(res.history),
              canRedo: histCanRedo(res.history),
            };
          }
          const res = tlStepBack(s.timeline);
          if (!res) return {};
          saveTimelineDebounced(res.snapshot.id, res.timeline);
          return {
            project: res.snapshot,
            timeline: res.timeline,
            canUndo: canStepBack(res.timeline),
            canRedo: canStepForward(res.timeline),
          };
        }),

      redo: () =>
        set((s) => {
          if (s.sketchSessionActive) {
            const res = histRedo(s.sketchHistory, s.project);
            if (!res) return {};
            return {
              project: res.state,
              sketchHistory: res.history,
              canUndo: histCanUndo(res.history),
              canRedo: histCanRedo(res.history),
            };
          }
          const res = tlStepForward(s.timeline);
          if (!res) return {};
          saveTimelineDebounced(res.snapshot.id, res.timeline);
          return {
            project: res.snapshot,
            timeline: res.timeline,
            canUndo: canStepBack(res.timeline),
            canRedo: canStepForward(res.timeline),
          };
        }),

      restoreVersion: (id) =>
        set((s) => {
          const timeline = tlRestore(s.timeline, id);
          if (timeline === s.timeline) return {}; // unknown id
          const snapshot = tlCurrent(timeline).snapshot;
          saveTimelineDebounced(snapshot.id, timeline);
          // Leaving any in-sketch session; the restored project is authoritative.
          return {
            project: snapshot,
            timeline,
            sketchSessionActive: false,
            sketchHistory: emptyHistory<CADProject>(),
            canUndo: canStepBack(timeline),
            canRedo: canStepForward(timeline),
          };
        }),

      // Awaits the write rather than going through the debouncer: this is an
      // explicit, one-off user action, and callers (the settings panel) need to
      // re-read storage usage once it has actually landed.
      clearHistory: async () => {
        const s = get();
        const timeline = createTimeline<CADProject>(s.project, 'Initial version');
        set({ timeline, canUndo: false, canRedo: false });
        await deleteTimeline(s.project.id);
        await saveTimeline(s.project.id, timeline);
      },

      beginSketchSession: () =>
        set({ sketchSessionActive: true, sketchHistory: emptyHistory<CADProject>(), canUndo: false, canRedo: false }),

      endSketchSession: () =>
        set((s) => ({
          sketchSessionActive: false,
          sketchHistory: emptyHistory<CADProject>(),
          canUndo: canStepBack(s.timeline),
          canRedo: canStepForward(s.timeline),
        })),

      hydrateTimeline: async () => {
        const projectId = get().project.id;
        const loaded = (await loadTimeline(projectId)) as Timeline<CADProject> | null;
        if (loaded && Array.isArray(loaded.entries) && loaded.entries.length > 0) {
          set((s) => {
            // `merge()` seeds a throwaway single-entry timeline synchronously, then
            // this lands async. If an edit arrived in between, the in-memory
            // timeline has already grown past its root and is the newer truth —
            // adopting the stored copy would discard that edit.
            if (s.timeline.entries.length > 1) return {};
            return {
              timeline: loaded,
              canUndo: s.sketchSessionActive ? s.canUndo : canStepBack(loaded),
              canRedo: s.sketchSessionActive ? s.canRedo : canStepForward(loaded),
            };
          });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => migrationTolerantStorage),
      // Only the project is durable in localStorage; the timeline lives in
      // IndexedDB (larger quota) and history is otherwise a session concern.
      partialize: (s) => ({ project: s.project }),
      // Apply the legacy field migration once, on rehydration, and seed the
      // timeline root from the rehydrated project.
      merge: (persisted, current) => {
        const p = (persisted as { project?: CADProject } | undefined)?.project;
        const project = p ? migrateProject(p) : current.project;
        return { ...current, project, timeline: createTimeline<CADProject>(project, 'Initial version') };
      },
    }
  )
);

// Load the persisted timeline once the project has rehydrated from localStorage.
if (typeof window !== 'undefined') {
  (window as any).__projectStore = useProjectStore;
  // Defer so localStorage rehydration (sync) completes first.
  queueMicrotask(() => {
    void useProjectStore.getState().hydrateTimeline();
  });
}
