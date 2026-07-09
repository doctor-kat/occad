/**
 * CAD Operation Handlers
 *
 * Barrel re-exporting the per-operation handlers, primitive builder, and
 * boolean dispatcher. Preserves the historical `@/cad/engine/operations`
 * import path used by the worker bridge and tests.
 */

export { handleBuildSketch } from './sketch/buildSketch';
export { handleExtrudeSketch, getPlanarFaceNormal, resolveExtrudeDirection } from './sketch/extrudeSketch';
export { handleRevolveSketch } from './sketch/revolveSketch';
export { buildPrimitiveShape } from './primitives';
export { performBooleanOperation } from './boolean';
export { handleRebuild } from './rebuild/handleRebuild';
export { handleGetFaceGeometry } from './faceGeometry';
export { handleGetEdgeLoop } from './edgeLoop';
export { handleResolveSelector } from './resolveSelector';
export { handleExportShape } from './exportShape';
export { handleMeasureShape } from './measureShapeHandler';
export { handleMeasureBetween } from './measureBetweenHandler';
