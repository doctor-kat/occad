import type { OpenCascadeInstance, TopoDS_Shape, TopoDS_Edge, TopoDS_Vertex } from 'opencascade.js';
import { Sketch, SketchPrimitive, Workplane, Point2D, Point3D } from '../../types';
import { project } from './coordinateSystem';
import { WorkerContext } from '../workerContext';

/**
 * Finds a shape (face, edge, or vertex) within a solid by its tag (e.g., "face-1", "edge-5").
 * Uses indexed maps to match the UI's selection mechanism.
 */
export function findShapeByTag(ctx: WorkerContext, body: TopoDS_Shape, tag: string): TopoDS_Shape | undefined {
  const { oc } = ctx;
  const match = tag.match(/^(face|edge|vertex)-(\d+)$/);
  if (!match) return undefined;

  const type = match[1];
  const index = parseInt(match[2]);

  let shapeType: any;
  if (type === 'face') shapeType = oc.TopAbs_ShapeEnum.TopAbs_FACE;
  else if (type === 'edge') shapeType = oc.TopAbs_ShapeEnum.TopAbs_EDGE;
  else if (type === 'vertex') shapeType = oc.TopAbs_ShapeEnum.TopAbs_VERTEX;
  else return undefined;

  const map = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(body, shapeType, map);

  let result: TopoDS_Shape | undefined;
  if (index >= 0 && index < map.Extent()) {
    result = map.FindKey(index + 1);
  }
  
  map.delete();
  return result;
}

/**
 * Projects an OpenCascade shape onto the sketch workplane.
 * Updates the planegcs primitive data with the new coordinates.
 */
export function reprojectExternalGeometry(
  ctx: WorkerContext,
  sketch: Sketch,
  body: TopoDS_Shape | null
): Sketch {
  if (!body) return sketch;
  const { oc } = ctx;

  const updatedPrimitives = sketch.primitives.map(primitive => {
    if (!primitive.isExternal || !primitive.sourceId) return primitive;

    const sourceShape = findShapeByTag(ctx, body, primitive.sourceId);
    if (!sourceShape) return primitive;

    try {
      if (primitive.type === 'point' && sourceShape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_VERTEX) {
        const vertex = oc.TopoDS.Vertex_1(sourceShape);
        const pnt = oc.BRep_Tool.Pnt(vertex);
        const p2d = project({ x: pnt.X(), y: pnt.Y(), z: pnt.Z() }, sketch.workplane);
        
        pnt.delete();
        return {
          ...primitive,
          data: { ...primitive.data, x: p2d.x, y: p2d.y }
        };
      }

      if (primitive.type === 'line' && sourceShape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_EDGE) {
        const edge = oc.TopoDS.Edge_1(sourceShape);
        const first = new oc.gp_Pnt_1();
        const last = new oc.gp_Pnt_1();
        // BRep_Tool::Points on edge would be better but we can get vertices
        const v1 = oc.TopExp.FirstVertex_1(edge, false);
        const v2 = oc.TopExp.LastVertex_1(edge, false);
        
        const p1 = oc.BRep_Tool.Pnt(v1);
        const p2 = oc.BRep_Tool.Pnt(v2);
        
        const p2d_1 = project({ x: p1.X(), y: p1.Y(), z: p1.Z() }, sketch.workplane);
        const p2d_2 = project({ x: p2.X(), y: p2.Y(), z: p2.Z() }, sketch.workplane);

        p1.delete();
        p2.delete();
        first.delete();
        last.delete();
        
        // Note: In planegcs, lines might reference point IDs instead of coordinates directly.
        // If so, we'd need to update the referenced points.
        // For simplicity, we assume 'data' contains the coordinates for now if it's a stand-alone line primitive.
        return {
          ...primitive,
          data: { 
            ...primitive.data, 
            p1: { x: p2d_1.x, y: p2d_1.y }, 
            p2: { x: p2d_2.x, y: p2d_2.y } 
          }
        };
      }
    } catch (err) {
      console.warn(`[Reprojection] Failed to re-project primitive ${primitive.id}:`, err);
    }

    return primitive;
  });

  return { ...sketch, primitives: updatedPrimitives };
}
