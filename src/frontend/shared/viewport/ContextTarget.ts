/**
 * What a viewport right-click resolved to. Drives which context menu is shown
 * (see ViewportContextMenu). Resolved from the entity under the cursor at
 * right-click time, or — on empty space — from the current selection, so
 * "right-click nothing with a selection" behaves like right-clicking the
 * selected item. Empty space with no selection resolves to `camera`.
 * (Lives here, in the shared layer, so the store doesn't depend on the canvas
 * layer; the resolution logic in canvas/contextMenu imports this type.)
 */
export type ContextTarget =
  | { kind: 'face'; faceId: number }
  | { kind: 'edge'; edgeIndex: number }
  | { kind: 'sketch-entity'; elementId: string }
  | { kind: 'camera' };
