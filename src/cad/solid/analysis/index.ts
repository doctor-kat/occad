/**
 * Measurement / Analysis engine (ROADMAP §4)
 *
 * Computes mass/volume, bounding-box, and inter-shape distance/angle
 * properties of a solid using the OCCT global-property and extrema tools
 * that ship in `opencascade.full.wasm`. Kept UI-agnostic: returns plain
 * numbers the main thread formats for display.
 */

export { measureShape } from './measureShape';
export { measureBetween } from './measureBetween';
export { measureHash, measureFingerprint } from './measureHash';
export type { MeasureHashOptions } from './measureHash';
