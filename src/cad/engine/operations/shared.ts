/**
 * Shared helpers and state for the operation handlers.
 */

import { SketchSolver } from '../SketchSolver';

/** Single sketch constraint solver instance shared by all handlers. */
export const solver = new SketchSolver();

/** Counter for generating unique shape IDs. */
let shapeIdCounter = 0;

/** Return the next unique shape-id suffix (post-increment semantics). */
export function nextShapeId(): number {
  return shapeIdCounter++;
}

/**
 * Format error object for display
 * OpenCascade C++ exceptions don't have proper message properties
 */
export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const errObj = err as any;
    if (typeof errObj === 'number') return `OpenCascade error (code: ${errObj})`;
    if (typeof errObj.message === 'string') return errObj.message;
    if (typeof errObj.toString === 'function') {
      const str = errObj.toString();
      if (str !== '[object Object]' && !/^\d+$/.test(str)) return str;
    }
  }
  return String(err);
}
