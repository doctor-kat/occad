export type { TessellationQuality } from './TessellationQuality';
export { TessellationLevel } from './TessellationLevel';
export type { TessellationPreset } from './TessellationPreset';

import type { TessellationQuality } from './TessellationQuality';
import { TessellationLevel } from './TessellationLevel';
import type { TessellationPreset } from './TessellationPreset';

/**
 * Preset table. `standard` deliberately matches the historical hardcoded
 * `0.1 / 0.5` values so existing projects render identically by default.
 */
export const TESSELLATION_PRESETS: Record<TessellationLevel, TessellationPreset> = {
  [TessellationLevel.Draft]: {
    label: 'Draft',
    description: 'Fewest faces — fastest rebuild, visibly faceted curves.',
    linearDeflection: 0.5,
    angularDeflection: 1.0,
  },
  [TessellationLevel.Standard]: {
    label: 'Standard',
    description: 'Balanced default.',
    linearDeflection: 0.1,
    angularDeflection: 0.5,
  },
  [TessellationLevel.Fine]: {
    label: 'Fine',
    description: 'More faces — smoother curves, slower rebuild.',
    linearDeflection: 0.03,
    angularDeflection: 0.2,
  },
  [TessellationLevel.Ultra]: {
    label: 'Ultra',
    description: 'Most faces — smoothest curves, slowest rebuild.',
    linearDeflection: 0.01,
    angularDeflection: 0.1,
  },
};

export const DEFAULT_TESSELLATION_LEVEL: TessellationLevel = TessellationLevel.Standard;

/** Resolve a level (or an already-resolved quality) to concrete deflection values. */
export function resolveTessellationQuality(
  level: TessellationLevel = DEFAULT_TESSELLATION_LEVEL
): TessellationQuality {
  const preset = TESSELLATION_PRESETS[level] ?? TESSELLATION_PRESETS[DEFAULT_TESSELLATION_LEVEL];
  return { linearDeflection: preset.linearDeflection, angularDeflection: preset.angularDeflection };
}
