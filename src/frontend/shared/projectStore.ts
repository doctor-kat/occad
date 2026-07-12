import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { CADProject, createNewProject } from '@/cad/types';
import { projectReducer, type ProjectAction } from '@/cad/state/projectReducer';
import { migrateProject } from '@/cad/state/projectHelpers';
import {
  History,
  emptyHistory,
  record,
  canUndo as histCanUndo,
  canRedo as histCanRedo,
  undo as histUndo,
  redo as histRedo,
} from '@/cad/state/history';

const STORAGE_KEY = 'occad-project';

export interface ProjectStore {
  /** The durable, migrated project. The single source of truth for model state. */
  project: CADProject;
  /** Snapshot undo/redo stacks (not persisted). */
  history: History<CADProject>;
  canUndo: boolean;
  canRedo: boolean;
  /** Apply a model mutation. Model edits (version change) record an undo snapshot. */
  dispatch: (action: ProjectAction) => void;
  undo: () => void;
  redo: () => void;
}

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

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      project: createNewProject(),
      history: emptyHistory<CADProject>(),
      canUndo: false,
      canRedo: false,

      dispatch: (action) =>
        set((s) => {
          const next = projectReducer(s.project, action);
          if (next === s.project) return {}; // reducer no-op
          // Record an undo point only when a model edit lands. Derived
          // enrichments keep `version`, so they stay invisible to undo.
          const history = next.version !== s.project.version ? record(s.history, s.project) : s.history;
          return {
            project: next,
            history,
            canUndo: histCanUndo(history),
            canRedo: histCanRedo(history),
          };
        }),

      undo: () =>
        set((s) => {
          const res = histUndo(s.history, s.project);
          if (!res) return {};
          return {
            project: res.state,
            history: res.history,
            canUndo: histCanUndo(res.history),
            canRedo: histCanRedo(res.history),
          };
        }),

      redo: () =>
        set((s) => {
          const res = histRedo(s.history, s.project);
          if (!res) return {};
          return {
            project: res.state,
            history: res.history,
            canUndo: histCanUndo(res.history),
            canRedo: histCanRedo(res.history),
          };
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => migrationTolerantStorage),
      // Only the project is durable; history is a session concern.
      partialize: (s) => ({ project: s.project }),
      // Apply the legacy field migration once, on rehydration.
      merge: (persisted, current) => {
        const p = (persisted as { project?: CADProject } | undefined)?.project;
        return { ...current, project: p ? migrateProject(p) : current.project };
      },
    }
  )
);

// Expose for debugging / e2e, mirroring viewportStore.
if (typeof window !== 'undefined') {
  (window as any).__projectStore = useProjectStore;
}
