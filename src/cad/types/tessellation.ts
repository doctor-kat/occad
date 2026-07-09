/**
 * Tessellation quality settings.
 *
 * Controls how finely OpenCascade meshes shapes for display — chiefly how many
 * facets curved surfaces (spheres, cylinders, fillets, …) are broken into.
 * Lower deflection values mean the mesh hugs the true surface more tightly, so
 * more triangles/faces are generated (smoother look, slower rebuild).
 *
 * - `linearDeflection`  — max distance (model units) between the mesh and the
 *   real surface. Drives overall triangle density.
 * - `angularDeflection` — max angle (radians) between adjacent facet normals.
 *   This is the dominant control of the facet count *around* a curve.
 */
export interface TessellationQuality {
  linearDeflection: number;
  angularDeflection: number;
}

/** Named tessellation presets, coarsest → finest. */
export enum TessellationLevel {
  Draft = 'draft',
  Standard = 'standard',
  Fine = 'fine',
  Ultra = 'ultra',
}

export interface TessellationPreset extends TessellationQuality {
  label: string;
  /** Short user-facing note on the trade-off. */
  description: string;
}

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
