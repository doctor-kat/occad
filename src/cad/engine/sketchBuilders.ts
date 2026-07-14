import type { OpenCascadeInstance, TopoDS_Shape, TopoDS_Edge, TopoDS_Wire } from 'opencascade.js';
import { Sketch, SketchPrimitive, Workplane, Point2D, Point3D } from '../types';
import { lift } from '@/cad/sketch/coordinateSystem';
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
  const primitivesById = new Map(sketch.primitives.map((p) => [p.id, p]));

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
          const p1Data = primitivesById.get(primitive.data.p1_id)?.data;
          const p2Data = primitivesById.get(primitive.data.p2_id)?.data;
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
          const centerData = primitivesById.get(centerPointId(primitive.data))?.data;
          if (!centerData) break;

          const center_3d = lift({ x: centerData.x, y: centerData.y }, workplane);
          const center = new oc.gp_Pnt_3(center_3d.x, center_3d.y, center_3d.z);
          const { x: nx, y: ny, z: nz } = workplane.normal;
          const normal = new oc.gp_Dir_4(nx, ny, nz);
          
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
          const centerData = primitivesById.get(centerPointId(primitive.data))?.data;
          if (!centerData) break;

          const center_3d = lift({ x: centerData.x, y: centerData.y }, workplane);
          const center = new oc.gp_Pnt_3(center_3d.x, center_3d.y, center_3d.z);
          const { x: nx, y: ny, z: nz } = workplane.normal;
          const normal = new oc.gp_Dir_4(nx, ny, nz);
          // The arc's start/end angles are measured CCW from the workplane X axis, so
          // pin the circle frame's reference X to it (the 2-arg gp_Ax2 lets OCC pick an
          // arbitrary X, which would rotate the arc). Full circles don't care, but arcs do.
          const xDir = new oc.gp_Dir_4(workplane.xAxis.x, workplane.xAxis.y, workplane.xAxis.z);

          const axis = new oc.gp_Ax2_3(center, normal, xDir);
          const circ = new oc.gp_Circ_2(axis, primitive.data.radius);

          // Arc by angle parameters: BRepBuilderAPI_MakeEdge_9(gp_Circ, alpha1, alpha2)
          // — CCW from alpha1 to alpha2. (_11 takes 2 TopoDS_Vertex — passing numbers
          // throws a BindingError.)
          const edge = new oc.BRepBuilderAPI_MakeEdge_9(circ, primitive.data.start_angle, primitive.data.end_angle);
          if (edge.IsDone()) {
            shape = edge.Edge();
          }
          center.delete();
          normal.delete();
          xDir.delete();
          axis.delete();
          edge.delete();
          break;
        }

        case 'ellipse': {
          const centerData = primitivesById.get(centerPointId(primitive.data))?.data;
          if (!centerData) break;

          const center_3d = lift({ x: centerData.x, y: centerData.y }, workplane);
          const center = new oc.gp_Pnt_3(center_3d.x, center_3d.y, center_3d.z);
          const { x: nx, y: ny, z: nz } = workplane.normal;
          const normal = new oc.gp_Dir_4(nx, ny, nz);
          
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
 * Groups the sketch's edge primitives into connected components and builds one
 * wire per component. A sketch can legitimately contain several disjoint profiles
 * (e.g. two separate rectangles); combining all their edges into a single
 * `BRepBuilderAPI_MakeWire` fails (a wire is a single connected loop), which used
 * to abort the whole sketch build — including the constraint solve round-trip.
 *
 * Line edges are connected when they share an endpoint *point id* (union-find);
 * each self-closed edge (circle/arc/ellipse) is its own component.
 *
 * @returns a single `TopoDS_Wire` when there is one profile, or a
 *   `TopoDS_Compound` of wires when there are several.
 */
export function buildSketchWire(
  ctx: WorkerContext,
  sketch: Sketch
): TopoDS_Shape {
  const { oc } = ctx;
  const shapes = translatePrimitivesToOCC(ctx, sketch);

  // Union-find over point ids so line edges sharing an endpoint land in one group.
  const parent = new Map<string, string>();
  const ensure = (x: string) => { if (!parent.has(x)) parent.set(x, x); };
  const find = (x: string): string => {
    ensure(x);
    while (parent.get(x) !== x) {
      const gp = parent.get(parent.get(x)!)!;
      parent.set(x, gp);
      x = gp;
    }
    return x;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };

  // Collect the edges to place, tagged with a provisional grouping key. Line edges
  // key on a point id (resolved to its component root after all unions); self-closed
  // edges key on their own primitive id.
  const tagged: { key: string; isPoint: boolean; edge: TopoDS_Shape }[] = [];
  for (const primitive of sketch.primitives) {
    if (primitive.isExternal) continue;
    if (primitive.type === 'point') continue;

    const shape = shapes.get(primitive.id);
    if (!shape || shape.ShapeType() !== oc.TopAbs_ShapeEnum.TopAbs_EDGE) continue;

    if (primitive.type === 'line') {
      const p1 = primitive.data.p1_id as string;
      const p2 = primitive.data.p2_id as string;
      union(p1, p2);
      tagged.push({ key: p1, isPoint: true, edge: shape });
    } else {
      tagged.push({ key: primitive.id, isPoint: false, edge: shape });
    }
  }

  if (tagged.length === 0) {
    throw new Error('No edges found in sketch to build wire');
  }

  // Resolve each edge to its connected-component root and group.
  const groups = new Map<string, TopoDS_Shape[]>();
  for (const { key, isPoint, edge } of tagged) {
    const root = isPoint ? `pt:${find(key)}` : `edge:${key}`;
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(edge);
  }

  // Build a wire per component. A component whose edges won't connect is skipped
  // (its constraints still round-trip; the profile just contributes no geometry).
  const wires: TopoDS_Shape[] = [];
  for (const groupEdges of groups.values()) {
    const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
    for (const edge of groupEdges) {
      wireBuilder.Add_1(oc.TopoDS.Edge_1(edge));
    }
    if (wireBuilder.IsDone()) {
      wires.push(wireBuilder.Wire());
    }
    wireBuilder.delete();
  }

  if (wires.length === 0) {
    throw new Error('BRepBuilderAPI_MakeWire failed to build any wire');
  }
  if (wires.length === 1) {
    return wires[0];
  }

  // Multiple disjoint profiles → return them as a compound of wires.
  const compound = new oc.TopoDS_Compound();
  const builder = new oc.BRep_Builder();
  builder.MakeCompound(compound);
  for (const w of wires) builder.Add(compound, w);
  builder.delete();
  return compound;
}

/**
 * Turn a sketch profile (a wire, or a compound of wires from {@link buildSketchWire})
 * into a face or a compound of faces. Each closed wire becomes one face; open or
 * unfaceable wires are skipped. Returns the input unchanged if nothing could be
 * faced (callers fall back to the wire for display).
 */
export function buildProfileFace(
  ctx: WorkerContext,
  profile: TopoDS_Shape
): TopoDS_Shape {
  const { oc } = ctx;

  const faceFromWire = (wire: TopoDS_Wire): TopoDS_Shape | null => {
    const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
    const face = faceMaker.IsDone() ? faceMaker.Face() : null;
    faceMaker.delete();
    return face;
  };

  if (profile.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
    return faceFromWire(oc.TopoDS.Wire_1(profile)) ?? profile;
  }

  if (profile.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_COMPOUND) {
    const wireMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(profile, oc.TopAbs_ShapeEnum.TopAbs_WIRE, wireMap);
    const compound = new oc.TopoDS_Compound();
    const builder = new oc.BRep_Builder();
    builder.MakeCompound(compound);
    let faces = 0;
    for (let i = 1; i <= wireMap.Extent(); i++) {
      const face = faceFromWire(oc.TopoDS.Wire_1(wireMap.FindKey(i)));
      if (face) { builder.Add(compound, face); faces++; }
    }
    builder.delete();
    return faces > 0 ? compound : profile;
  }

  return profile;
}
