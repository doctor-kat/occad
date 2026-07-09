import type { ContextTarget } from './ContextTarget';

/** An open viewport right-click menu: cursor position (client px) + what was hit. */
export interface ContextMenuState {
  x: number;
  y: number;
  target: ContextTarget;
}
