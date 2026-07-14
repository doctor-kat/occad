/**
 * Advanced Modeling Operations
 *
 * Engine handlers for the "Advanced modeling" feature family: sweep and loft.
 * Unlike modifications/transforms (which act on the current body in place),
 * sweep and loft each produce a *standalone* solid from sketch profiles, which
 * `handleRebuild` then boolean-combines with the accumulated body (union for a
 * boss, subtract for a cut) — the same pattern as extrude/revolve.
 *
 *  - Sweep: a closed profile face is swept along a path/spine wire
 *    (`BRepOffsetAPI_MakePipe`).
 *  - Loft: a solid is built through a series of section wires
 *    (`BRepOffsetAPI_ThruSections`).
 */

export { applySweep } from './sweep';
export { applyLoft } from './loft';
