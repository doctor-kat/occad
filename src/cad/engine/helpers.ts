/**
 * Worker Helper Utilities
 *
 * Shared helper functions for OpenCascade worker operations.
 */

type TopoDS_Shape = any;
type TopoDS_Face = any;
import type { MeshData } from '@/cad/types';
import type { WorkerContext } from './workerContext';

/**
 * Extract transferable objects from mesh data for zero-copy postMessage
 * @param meshData Mesh data containing typed arrays
 * @returns Array of transferable ArrayBuffers
 */
export function getTransferables(meshData: MeshData): Transferable[] {
  const transferables: Transferable[] = [
    meshData.faceVertices.buffer,
    meshData.faceNormals.buffer,
    meshData.faceIndices.buffer,
    meshData.edgeVertices.buffer,
    meshData.edgeIndices.buffer,
  ];

  if (meshData.faceMapping) {
    transferables.push(meshData.faceMapping.buffer);
  }
  if (meshData.edgeMapping) {
    transferables.push(meshData.edgeMapping.buffer);
  }

  return transferables;
}

/**
 * Find a sketch shape in storage by sketch ID
 * @param ctx Worker context
 * @param sketchId Sketch ID to search for
 * @returns Shape if found, undefined otherwise
 */
export function findSketchShape(ctx: WorkerContext, sketchId: string): TopoDS_Shape | undefined {
  const shapeId = Array.from(ctx.shapeStorage.keys()).find(id => id.startsWith(`sketch_${sketchId}_`));
  return shapeId ? ctx.shapeStorage.get(shapeId) : undefined;
}

/**
 * Ensure a shape is a face (convert wire to face if needed)
 * @param ctx Worker context
 * @param shape Shape to convert
 * @returns Face shape
 */
export function ensureFace(ctx: WorkerContext, shape: TopoDS_Shape): TopoDS_Face {
  const { oc } = ctx;

  // A compound (multiple faces from disjoint profiles) is already extrudable as-is —
  // BRepPrimAPI_MakePrism prisms each contained face. Pass it through untouched.
  if (shape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_COMPOUND) {
    return shape as TopoDS_Face;
  }

  if (shape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
    // Downcast TopoDS_Shape to TopoDS_Wire
    const wire = oc.TopoDS.Wire_1(shape);
    const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, false);

    if (!faceMaker.IsDone()) {
      throw new Error(`BRepBuilderAPI_MakeFace failed: ${faceMaker.Error()}`);
    }

    const res = faceMaker.Face();
    faceMaker.delete();
    return res;
  }

  return shape as TopoDS_Face;
}

/**
 * Ensure a shape is a wire — used by sweep/loft, which need wire spines and
 * section wires. A face yields its outer wire; a lone edge is wrapped in a
 * single-edge wire; a compound yields its first contained wire (or an edge
 * wrapped as a wire). Throws if no wire/edge can be derived.
 */
export function ensureWire(ctx: WorkerContext, shape: TopoDS_Shape): TopoDS_Shape {
  const { oc } = ctx;
  const kind = shape.ShapeType();

  if (kind === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
    return oc.TopoDS.Wire_1(shape);
  }
  if (kind === oc.TopAbs_ShapeEnum.TopAbs_EDGE) {
    const wb = new oc.BRepBuilderAPI_MakeWire_2(oc.TopoDS.Edge_1(shape));
    const wire = wb.Wire();
    wb.delete();
    return wire;
  }
  if (kind === oc.TopAbs_ShapeEnum.TopAbs_FACE) {
    return oc.BRepTools.OuterWire(oc.TopoDS.Face_1(shape));
  }

  // Compound (or anything else): prefer a contained wire, else wrap the first edge.
  const wireMap = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_WIRE, wireMap);
  if (wireMap.Extent() > 0) {
    const wire = oc.TopoDS.Wire_1(wireMap.FindKey(1));
    wireMap.delete();
    return wire;
  }
  wireMap.delete();

  const edgeMap = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, edgeMap);
  if (edgeMap.Extent() > 0) {
    const wb = new oc.BRepBuilderAPI_MakeWire_2(oc.TopoDS.Edge_1(edgeMap.FindKey(1)));
    const wire = wb.Wire();
    wb.delete();
    edgeMap.delete();
    return wire;
  }
  edgeMap.delete();

  throw new Error('ensureWire: shape contains no wire or edge');
}
