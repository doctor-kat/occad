import { describe, it, expect } from 'vitest';
import {
  TESSELLATION_PRESETS,
  DEFAULT_TESSELLATION_LEVEL,
  resolveTessellationQuality,
  type TessellationLevel,
} from './tessellation';

describe('tessellation presets', () => {
  it('Standard matches the historical hardcoded 0.1 / 0.5 defaults', () => {
    expect(TESSELLATION_PRESETS.standard.linearDeflection).toBe(0.1);
    expect(TESSELLATION_PRESETS.standard.angularDeflection).toBe(0.5);
    expect(DEFAULT_TESSELLATION_LEVEL).toBe('standard');
  });

  it('deflection decreases monotonically from draft → ultra (more faces)', () => {
    const order: TessellationLevel[] = ['draft', 'standard', 'fine', 'ultra'];
    for (let i = 1; i < order.length; i++) {
      expect(TESSELLATION_PRESETS[order[i]].linearDeflection).toBeLessThan(
        TESSELLATION_PRESETS[order[i - 1]].linearDeflection
      );
      expect(TESSELLATION_PRESETS[order[i]].angularDeflection).toBeLessThan(
        TESSELLATION_PRESETS[order[i - 1]].angularDeflection
      );
    }
  });

  it('resolveTessellationQuality returns the preset deflection for a level', () => {
    expect(resolveTessellationQuality('fine')).toEqual({
      linearDeflection: TESSELLATION_PRESETS.fine.linearDeflection,
      angularDeflection: TESSELLATION_PRESETS.fine.angularDeflection,
    });
  });

  it('resolveTessellationQuality falls back to the default for unknown/undefined', () => {
    const fallback = resolveTessellationQuality();
    expect(fallback).toEqual({
      linearDeflection: TESSELLATION_PRESETS[DEFAULT_TESSELLATION_LEVEL].linearDeflection,
      angularDeflection: TESSELLATION_PRESETS[DEFAULT_TESSELLATION_LEVEL].angularDeflection,
    });
    // @ts-expect-error — exercising the runtime guard for a bad level
    expect(resolveTessellationQuality('nonsense')).toEqual(fallback);
  });
});
