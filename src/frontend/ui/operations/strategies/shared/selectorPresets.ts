/** Common presets for the selector-rule input — discoverable without learning the DSL. */
export const EDGE_SELECTOR_PRESETS = [
  { label: 'All vertical edges', selector: '|Z' },
  { label: 'Top edges', selector: '>Z' },
  { label: 'Bottom edges', selector: '<Z' },
];
export const FACE_SELECTOR_PRESETS = [
  { label: 'Top face', selector: '>Z' },
  { label: 'Bottom face', selector: '<Z' },
  { label: 'Side faces', selector: '#Z' },
];
