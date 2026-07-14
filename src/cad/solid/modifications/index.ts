/**
 * Modification Operations
 *
 * Engine handlers for the "Modifications" feature family: fillet, chamfer,
 * shell, and offset. Unlike sketch-based features and primitives, these do not
 * produce a standalone body that is then boolean-combined — they transform the
 * *current* body in place (selecting edges to round/bevel, or faces to remove /
 * offset). During a parametric rebuild they receive the accumulated body and
 * return the modified body, which becomes the new current body.
 *
 * Selection references use the same 0-based `edge-N` / `face-N` scheme produced
 * by `handleGetFaceGeometry` and the Entities panel; `resolveSubShapes` maps
 * them back to the OCC sub-shapes of the body being modified.
 *
 * One file per operation (fillet.ts, chamfer.ts, shell.ts, offset.ts), with
 * shared cross-operation helpers in shared.ts.
 */

export { applyFillet } from './fillet';
export { applyChamfer } from './chamfer';
export { applyShell } from './shell';
export { applyOffset } from './offset';
export { withSelectorMatches, resolveSubShapes, enrichRefs, OFFSET_TOL } from './shared';
export type { ResolvedSubShapes } from './shared';
export { parseGeometryIndex } from '@/cad/types';
