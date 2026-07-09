import type { TessellationQuality } from './TessellationQuality';

export interface TessellationPreset extends TessellationQuality {
  label: string;
  /** Short user-facing note on the trade-off. */
  description: string;
}
