import { describe, expect, it } from 'vitest';
import { TessellationLevel } from '@/cad/types/tessellation/TessellationLevel';
import { shouldRebuild, type RebuildInputs } from './rebuildScheduler';

function inputs(overrides: Partial<RebuildInputs> = {}): RebuildInputs {
  return {
    projectId: 'p1',
    version: 1,
    tessellationLevel: TessellationLevel.Standard,
    ...overrides,
  };
}

describe('shouldRebuild', () => {
  it('does nothing on initial load with no features (version 0)', () => {
    expect(shouldRebuild(null, inputs({ version: 0 }))).toBe('none');
  });

  it('rebuilds on initial load when version is non-zero', () => {
    expect(shouldRebuild(null, inputs({ version: 1 }))).toBe('rebuild');
  });

  it('rebuilds when version changes upward', () => {
    expect(shouldRebuild(inputs({ version: 1 }), inputs({ version: 2 }))).toBe('rebuild');
  });

  it('rebuilds on undo, where version decreases', () => {
    expect(shouldRebuild(inputs({ version: 5 }), inputs({ version: 2 }))).toBe('rebuild');
  });

  it('clears when project id changes', () => {
    expect(shouldRebuild(inputs({ projectId: 'p1' }), inputs({ projectId: 'p2' }))).toBe('clear');
  });

  it('remeshes when only tessellation level changes', () => {
    expect(
      shouldRebuild(
        inputs({ tessellationLevel: TessellationLevel.Standard }),
        inputs({ tessellationLevel: TessellationLevel.Fine })
      )
    ).toBe('remesh');
  });

  it('does nothing when nothing changes', () => {
    expect(shouldRebuild(inputs(), inputs())).toBe('none');
  });

  it('prioritizes project-id change over version/tessellation changes', () => {
    expect(
      shouldRebuild(
        inputs({ projectId: 'p1', version: 1 }),
        inputs({ projectId: 'p2', version: 2, tessellationLevel: TessellationLevel.Fine })
      )
    ).toBe('clear');
  });
});
