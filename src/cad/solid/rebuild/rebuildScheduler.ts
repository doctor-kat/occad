import type { TessellationLevel } from '@/cad/types/tessellation/TessellationLevel';

export interface RebuildInputs {
  projectId: string;
  version: number;
  tessellationLevel: TessellationLevel;
}

export type RebuildVerdict = 'rebuild' | 'remesh' | 'clear' | 'none';

/**
 * Pure decision function for what the OCC worker should do when project/tessellation
 * inputs change. Callers own applying the verdict (clearing mesh, calling rebuild, etc).
 */
export function shouldRebuild(prev: RebuildInputs | null, next: RebuildInputs): RebuildVerdict {
  if (prev === null) {
    return next.version !== 0 ? 'rebuild' : 'none';
  }

  if (prev.projectId !== next.projectId) {
    return 'clear';
  }

  // `!==` not `>`: undo restores a snapshot with a LOWER version, and must still rebuild.
  if (prev.version !== next.version) {
    return 'rebuild';
  }

  if (prev.tessellationLevel !== next.tessellationLevel) {
    return 'remesh';
  }

  return 'none';
}
