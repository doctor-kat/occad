import { CADProject, Feature, Sketch } from '@/cad/types';
import { ProjectAction } from './projectReducer';

/**
 * Produces a short, human-readable label for a {@link ProjectAction} — the
 * "operation diff name" shown in a version-history list. Pure and defensive:
 * strict mode is off and param/entity shapes vary at runtime, so every lookup
 * is guarded and falls back to a generic label rather than throwing.
 *
 * Actions that only carry derived/rebuild data (ref enrichments, geometry
 * writes) return `''` so callers can skip them in the history list.
 */
export function describeAction(action: ProjectAction, prev: CADProject, next: CADProject): string {
  try {
    return describeActionUnsafe(action, prev, next);
  } catch {
    return '';
  }
}

function describeActionUnsafe(action: ProjectAction, prev: CADProject, next: CADProject): string {
  switch (action.type) {
    case 'REPLACE':
      return 'Restored project';

    case 'TOUCH':
      return 'Saved';

    case 'ADD_SKETCH':
      return `Created ${nameOf(action.sketch, 'Sketch')}`;

    case 'UPDATE_SKETCH_ELEMENTS': {
      const sketch = findSketch(next, action.sketchId) ?? findSketch(prev, action.sketchId);
      return `Edited ${nameOf(sketch, 'Sketch')}`;
    }

    case 'UPDATE_SKETCH_STATE': {
      const sketch = findSketch(next, action.sketchId) ?? action.sketch;
      return `Edited ${nameOf(sketch, 'Sketch')}`;
    }

    case 'ADD_CONSTRAINT': {
      const sketch = findSketch(prev, action.sketchId) ?? findSketch(next, action.sketchId);
      return `Added constraint to ${nameOf(sketch, 'Sketch')}`;
    }

    case 'REMOVE_CONSTRAINT': {
      const sketch = findSketch(prev, action.sketchId) ?? findSketch(next, action.sketchId);
      return `Removed constraint from ${nameOf(sketch, 'Sketch')}`;
    }

    case 'UPDATE_SKETCH_GEOMETRY':
      return '';

    case 'STOP_SKETCH_EDIT': {
      const sketch = findSketch(prev, action.sketchId) ?? findSketch(next, action.sketchId);
      return `Edited ${nameOf(sketch, 'Sketch')}`;
    }

    case 'DELETE_SKETCH': {
      const sketch = findSketch(prev, action.sketchId);
      return `Deleted ${nameOf(sketch, 'Sketch')}`;
    }

    case 'ADD_FEATURE':
      return `Added ${nameOf(action.feature, 'Feature')}`;

    case 'UPDATE_FEATURE_PARAMETERS': {
      const prevFeature = findFeature(prev, action.featureId);
      const nextFeature = findFeature(next, action.featureId);
      const label = nameOf(nextFeature ?? prevFeature, 'Feature');
      const diff = diffParams(prevFeature?.parameters, action.parameters);
      return diff ? `${label}: ${diff}` : `Edited ${label}`;
    }

    case 'UPDATE_FEATURE_GEOMETRY':
      return '';

    case 'APPLY_REF_ENRICHMENTS':
    case 'APPLY_SKETCH_REF_ENRICHMENTS':
      return '';

    case 'TOGGLE_FEATURE_SUPPRESSION': {
      const nextFeature = findFeature(next, action.featureId) ?? findFeature(prev, action.featureId);
      const label = nameOf(nextFeature, 'Feature');
      return nextFeature?.isSuppressed ? `Suppressed ${label}` : `Unsuppressed ${label}`;
    }

    case 'TOGGLE_FEATURE_VISIBILITY': {
      const nextFeature = findFeature(next, action.featureId) ?? findFeature(prev, action.featureId);
      const label = nameOf(nextFeature, 'Feature');
      return nextFeature?.isVisible === false ? `Hid ${label}` : `Showed ${label}`;
    }

    case 'DELETE_FEATURE': {
      const feature = findFeature(prev, action.featureId);
      return `Deleted ${nameOf(feature, 'Feature')}`;
    }

    case 'REORDER_FEATURE': {
      const feature = findFeature(next, action.featureId) ?? findFeature(prev, action.featureId);
      return `Reordered ${nameOf(feature, 'Feature')}`;
    }

    case 'MOVE_ROLLBACK_BAR':
      return 'Moved history bar';

    case 'DELETE_TREE_ITEM': {
      // A tree delete removes a sketch or feature (and bumps version), so it
      // must be labelled — resolve the id against the pre-delete project.
      const sketch = findSketch(prev, action.id);
      if (sketch) return `Deleted ${nameOf(sketch, 'Sketch')}`;
      const feature = findFeature(prev, action.id);
      return `Deleted ${nameOf(feature, 'Feature')}`;
    }

    case 'TOGGLE_TREE_ITEM_EXPANSION':
    case 'TOGGLE_TREE_ITEM_VISIBILITY':
      return '';

    default:
      return '';
  }
}

function findSketch(project: CADProject | undefined | null, id: string): Sketch | undefined {
  return project?.sketches?.find?.((s) => s?.id === id);
}

function findFeature(project: CADProject | undefined | null, id: string): Feature | undefined {
  return project?.features?.find?.((f) => f?.id === id);
}

function nameOf(entity: { name?: string } | undefined | null, fallback: string): string {
  return (entity && typeof entity.name === 'string' && entity.name.trim()) || fallback;
}

/**
 * Best-effort diff of two param bags: reports changed numeric keys shared by
 * both, e.g. "depth 10 → 20 mm". Returns null (not a clean diff) when either
 * side is missing/not an object, or nothing numeric changed.
 */
function diffParams(prevParams: unknown, nextParams: unknown): string | null {
  if (!isPlainObject(prevParams) || !isPlainObject(nextParams)) return null;

  const changes: string[] = [];
  for (const key of Object.keys(nextParams)) {
    const prevVal = (prevParams as Record<string, unknown>)[key];
    const nextVal = (nextParams as Record<string, unknown>)[key];
    if (typeof prevVal !== 'number' || typeof nextVal !== 'number') continue;
    if (prevVal === nextVal) continue;
    changes.push(`${key} ${formatNumber(prevVal)} → ${formatNumber(nextVal)}`);
  }

  if (!changes.length) return null;
  const unit = isPlainObject(nextParams) && typeof (nextParams as any).unit === 'string' ? ` ${(nextParams as any).unit}` : ' mm';
  return `${changes.join(', ')}${unit}`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}