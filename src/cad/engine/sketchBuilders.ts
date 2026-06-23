import type { OpenCascadeInstance, TopoDS_Shape, TopoDS_Edge, TopoDS_Wire } from 'opencascade.js';
import { Sketch, SketchPrimitive, Workplane, Point2D, Point3D } from '../types';
import { lift } from './sketch/coordinateSystem';
import { WorkerContext } from './workerContext';

/**
 * Resolve a circle/arc/ellipse center point id. planegcs uses `c_id`; older/unsolved
 * data may still carry `center_id`. Accept both so solved and unsolved primitives work.
 */
function centerPointId(data: any): string | undefined {
  return data.c_id ?? data.center_id;
}

/**
 * Translates planegcs primitives into OpenCascade shapes.
 * This is the "Translation Layer" mentioned in the requirements.
 */
export function translatePrimitivesToOCC(
  ctx: WorkerContext,
  sketch: Sketch
): Map<string, TopoDS_Shape> {
  const { oc } = ctx;
  const shapes = new Map<string, TopoDS_Shape>();
  const workplane = sketch.workplane;

  for (const primitive of sketch.primitives) {
    try {
      let shape: TopoDS_Shape | undefined;

      switch (primitive.type) {
        case 'point': {
          const p3d = lift({ x: primitive.data.x, y: primitive.data.y }, workplane);
          const pnt = new oc.gp_Pnt_3(p3d.x, p3d.y, p3d.z);
          const vertex = new oc.BRepBuilderAPI_MakeVertex(pnt);
          shape = vertex.Vertex();
          pnt.delete();
          vertex.delete();
          break;
        }

        case 'line': {
          const p1Data = sketch.primitives.find(p => p.id === primitive.data.p1_id)?.data;
          const p2Data = sketch.primitives.find(p => p.id === primitive.data.p2_id)?.data;
          if (!p1Data || !p2Data) break;

          const p1_3d = lift({ x: p1Data.x, y: p1Data.y }, workplane);
          const p2_3d = lift({ x: p2Data.x, y: p2Data.y }, workplane);
          const p1 = new oc.gp_Pnt_3(p1_3d.x, p1_3d.y, p1_3d.z);
          const p2 = new oc.gp_Pnt_3(p2_3d.x, p2_3d.y, p2_3d.z);

          const edge = new oc.BRepBuilderAPI_MakeEdge_3(p1, p2);
          if (edge.IsDone()) {
            shape = edge.Edge();
          }
          p1.delete();
          p2.delete();
          edge.delete();
          break;
        }

        case 'circle': {
          const centerData = sketch.primitives.find(p => p.id === centerPointId(primitive.data))?.data;
          if (!centerData) break;

          const center_3d = lift({ x: centerData.x, y: centerData.y }, workplane);
          const center = new oc.gp_Pnt_3(center_3d.x, center_3d.y, center_3d.z);
          const normal = new oc.gp_Dir_4(workplane.normal.x, workplane.normal.y, workplane.normal.z);
          
          const axis = new oc.gp_Ax2_3(center, normal);
          const circ = new oc.gp_Circ_2(axis, primitive.data.radius);

          // Full circle: BRepBuilderAPI_MakeEdge_8(gp_Circ). (_10 takes gp_Circ + 2
          // gp_Pnt trim points — calling it with one arg throws a BindingError.)
          const edge = new oc.BRepBuilderAPI_MakeEdge_8(circ);
          if (edge.IsDone()) {
            shape = edge.Edge();
          }
          center.delete();
          normal.delete();
          axis.delete();
          edge.delete();
          break;
        }

        case 'arc': {
          const centerData = sketch.primitives.find(p => p.id === centerPointId(primitive.data))?.data;
          if (!centerData) break;

          const center_3d = lift({ x: centerData.x, y: centerData.y }, workplane);
          const center = new oc.gp_Pnt_3(center_3d.x, center_3d.y, center_3d.z);
          const normal = new oc.gp_Dir_4(workplane.normal.x, workplane.normal.y, workplane.normal.z);
          
          const axis = new oc.gp_Ax2_3(center, normal);
          const circ = new oc.gp_Circ_2(axis, primitive.data.radius);

          // planegcs angles are in local frame from workplane X direction.
          // Arc by angle parameters: BRepBuilderAPI_MakeEdge_9(gp_Circ, p1, p2).
          // (_11 takes 2 TopoDS_Vertex — passing numbers throws a BindingError.)
          const edge = new oc.BRepBuilderAPI_MakeEdge_9(circ, primitive.data.start_angle, primitive.data.end_angle);
          if (edge.IsDone()) {
            shape = edge.Edge();
          }
          center.delete();
          normal.delete();
          axis.delete();
          edge.delete();
          break;
        }

        case 'ellipse': {
          const centerData = sketch.primitives.find(p => p.id === centerPointId(primitive.data))?.data;
          if (!centerData) break;

          const center_3d = lift({ x: centerData.x, y: centerData.y }, workplane);
          const center = new oc.gp_Pnt_3(center_3d.x, center_3d.y, center_3d.z);
          const normal = new oc.gp_Dir_4(workplane.normal.x, workplane.normal.y, workplane.normal.z);
          
          // planegcs ellipse data usually has majorDir or similar
          // Re-constructing gp_Elips as per user instructions
          // focalDist = sqrt(radmaj² - radmin²)
          const radmaj = primitive.data.major_radius;
          const radmin = primitive.data.minor_radius;
          
          // Need a major direction. If not provided, use workplane X
          const majorDirVec = primitive.data.major_dir 
            ? new oc.gp_Dir_4(primitive.data.major_dir.x, primitive.data.major_dir.y, primitive.data.major_dir.z)
            : new oc.gp_Dir_4(workplane.xAxis.x, workplane.xAxis.y, workplane.xAxis.z);

          const axis = new oc.gp_Ax2_3(center, normal, majorDirVec);
          const elips = new oc.gp_Elips_4(axis, radmaj, radmin);

          const edge = new oc.BRepBuilderAPI_MakeEdge_12(elips);
          if (edge.IsDone()) {
            shape = edge.Edge();
          }
          center.delete();
          normal.delete();
          majorDirVec.delete();
          axis.delete();
          edge.delete();
          break;
        }
      }

      if (shape) {
        shapes.set(primitive.id, shape);
      }
    } catch (err) {
      console.warn(`[TranslationLayer] Failed to translate primitive ${primitive.id}:`, err);
    }
  }

  return shapes;
}

/**
 * Builds a final wire/face from sketch primitives.
 * Only non-external primitives forming closed wires are used.
 */
export function buildSketchWire(
  ctx: WorkerContext,
  sketch: Sketch
): TopoDS_Shape {
  const { oc } = ctx;
  const shapes = translatePrimitivesToOCC(ctx, sketch);
  
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
  let edgesAdded = 0;

  // Filter for non-external edges that can form a wire
  for (const primitive of sketch.primitives) {
    if (primitive.isExternal) continue;
    if (primitive.type === 'point') continue;

    const shape = shapes.get(primitive.id);
    if (shape && shape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_EDGE) {
      wireBuilder.Add_1(oc.TopoDS.Edge_1(shape));
      edgesAdded++;
    }
  }

  if (edgesAdded === 0) {
    throw new Error('No edges found in sketch to build wire');
  }

  if (!wireBuilder.IsDone()) {
    const error = wireBuilder.Error();
    wireBuilder.delete();
    throw new Error(`BRepBuilderAPI_MakeWire failed with error code: ${error}`);
  }

  const wire = wireBuilder.Wire();
  wireBuilder.delete();
  
  return wire;
}
