/**
 * Sketch Geometry Builders
 *
 * Pure functions for converting 2D sketch elements to 3D OpenCascade geometry.
 */

import type { gp_Pnt, gp_Dir, TopoDS_Edge, TopoDS_Wire } from 'opencascade.js';
import type { SketchElement, SketchPlane, Point2D } from '@/types/cad';
import type { WorkerContext } from './workerContext';

/**
 * Decode BRepBuilderAPI_WireError enum to human-readable string
 * @param ctx Worker context
 * @param errorCode Wire error enum value
 * @returns Human-readable error description
 */
function decodeWireError(ctx: WorkerContext, errorCode: any): string {
  const { oc } = ctx;
  const errorValue = typeof errorCode === 'number' ? errorCode : errorCode?.value ?? -1;

  // BRepBuilderAPI_WireError enum values
  const errors: Record<number, string> = {
    0: 'WireDone (no error)',
    1: 'EmptyWire',
    2: 'DisconnectedWire (edges not connected)',
    3: 'NonManifoldWire (more than 2 edges share a vertex)',
  };

  return errors[errorValue] || `Unknown error code: ${errorValue}`;
}

/**
 * Convert 2D sketch point to 3D point on sketch plane
 * @param ctx Worker context
 * @param point2D 2D point in sketch space
 * @param plane Sketch plane definition
 * @returns 3D point on the plane
 */
export function sketchPointTo3D(ctx: WorkerContext, point2D: Point2D, plane: SketchPlane): gp_Pnt {
  const { oc } = ctx;
  const offset = plane.offset || 0;

  switch (plane.type) {
    case 'xy':
      const pt = new oc.gp_Pnt_3(point2D.x, point2D.y, offset);
      // Debug logging
      if (Math.abs(point2D.x) > 200 || Math.abs(point2D.y) > 200) {
        console.warn(`Large 2D coordinates detected: (${point2D.x}, ${point2D.y}) on XY plane`);
      }
      return pt;
    case 'xz':
      const ptXZ = new oc.gp_Pnt_3(point2D.x, offset, point2D.y);
      console.log(`[XZ Plane] 2D sketch (${point2D.x.toFixed(2)}, ${point2D.y.toFixed(2)}) → 3D world (${point2D.x.toFixed(2)}, ${offset}, ${point2D.y.toFixed(2)})`);
      return ptXZ;
    case 'yz':
      return new oc.gp_Pnt_3(offset, point2D.x, point2D.y);
    case 'custom':
      if (plane.origin && plane.normal) {
        // Create a local coordinate system on the custom plane
        const origin = new oc.gp_Pnt_3(plane.origin.x, plane.origin.y, plane.origin.z);
        const normal = new oc.gp_Dir_4(plane.normal.x, plane.normal.y, plane.normal.z);

        // Create coordinate system with default axis (auto-computes X/Y from Z direction)
        const ax2 = new oc.gp_Ax2_1();
        ax2.SetLocation(origin);
        ax2.SetDirection(normal);

        // Convert 2D point to 3D point on the plane
        const u = point2D.x;
        const v = point2D.y;

        // Get the X and Y directions from the coordinate system
        const xAxis = ax2.XDirection();
        const yAxis = ax2.YDirection();
        const pos = ax2.Location();

        // Calculate 3D point: origin + u*xDir + v*yDir
        const x = pos.X() + u * xAxis.X() + v * yAxis.X();
        const y = pos.Y() + u * xAxis.Y() + v * yAxis.Y();
        const z = pos.Z() + u * xAxis.Z() + v * yAxis.Z();

        return new oc.gp_Pnt_3(x, y, z);
      }
      // Fallback to XY plane
      return new oc.gp_Pnt_3(point2D.x, point2D.y, offset);
    default:
      return new oc.gp_Pnt_3(point2D.x, point2D.y, offset);
  }
}

/**
 * Get sketch plane normal vector
 * @param ctx Worker context
 * @param plane Sketch plane definition
 * @returns Normal direction vector
 */
export function getSketchPlaneNormal(ctx: WorkerContext, plane: SketchPlane): gp_Dir {
  const { oc } = ctx;

  switch (plane.type) {
    case 'xy':
      return new oc.gp_Dir_4(0, 0, 1); // Z-up
    case 'xz':
      return new oc.gp_Dir_4(0, 1, 0); // Y-up
    case 'yz':
      return new oc.gp_Dir_4(1, 0, 0); // X-up
    case 'custom':
      if (plane.normal) {
        return new oc.gp_Dir_4(plane.normal.x, plane.normal.y, plane.normal.z);
      }
    // fallthrough
    default:
      return new oc.gp_Dir_4(0, 0, 1);
  }
}

/**
 * Build a line edge from sketch line
 * @param ctx Worker context
 * @param line Line element
 * @param plane Sketch plane
 * @returns Line edge
 */
export function buildLineEdge(
  ctx: WorkerContext,
  line: SketchElement & { type: 'line' },
  plane: SketchPlane
): TopoDS_Edge {
  const { oc } = ctx;
  const p1 = sketchPointTo3D(ctx, line.start, plane);
  const p2 = sketchPointTo3D(ctx, line.end, plane);

  const segment = new oc.GC_MakeSegment_1(p1, p2);
  if (!segment.IsDone()) {
    throw new Error(`GC_MakeSegment failed: ${segment.Status()}`);
  }

  const edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(segment.Value().get()));
  if (!edge.IsDone()) {
    throw new Error(`BRepBuilderAPI_MakeEdge failed: ${edge.Error()}`);
  }

  return edge.Edge();
}

/**
 * Build a circle edge from sketch circle
 * @param ctx Worker context
 * @param circle Circle element
 * @param plane Sketch plane
 * @returns Circle edge
 */
export function buildCircleEdge(
  ctx: WorkerContext,
  circle: SketchElement & { type: 'circle' },
  plane: SketchPlane
): TopoDS_Edge {
  const { oc } = ctx;
  const center = sketchPointTo3D(ctx, circle.center, plane);
  const normal = getSketchPlaneNormal(ctx, plane);

  const circleGeom = new oc.GC_MakeCircle_6(center, normal, circle.radius);
  if (!circleGeom.IsDone()) {
    throw new Error(`GC_MakeCircle failed: ${circleGeom.Status()}`);
  }

  const edge = new oc.BRepBuilderAPI_MakeEdge_23(new oc.Handle_Geom_Curve_2(circleGeom.Value().get()));
  if (!edge.IsDone()) {
    throw new Error(`BRepBuilderAPI_MakeEdge failed: ${edge.Error()}`);
  }

  return edge.Edge();
}

/**
 * Build an arc edge from sketch arc
 * @param ctx Worker context
 * @param arc Arc element
 * @param plane Sketch plane
 * @returns Arc edge
 */
export function buildArcEdge(
  ctx: WorkerContext,
  arc: SketchElement & { type: 'arc' },
  plane: SketchPlane
): TopoDS_Edge {
  const { oc } = ctx;

  if (arc.points) {
    // Three-point arc
    const p1 = sketchPointTo3D(ctx, arc.points[0], plane);
    const p2 = sketchPointTo3D(ctx, arc.points[1], plane);
    const p3 = sketchPointTo3D(ctx, arc.points[2], plane);

    const arcGeom = new oc.GC_MakeArcOfCircle_4(p1, p2, p3);
    if (!arcGeom.IsDone()) {
      throw new Error(`GC_MakeArcOfCircle failed: ${arcGeom.Status()}`);
    }

    const edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(arcGeom.Value().get()));
    if (!edge.IsDone()) {
      throw new Error(`BRepBuilderAPI_MakeEdge failed: ${edge.Error()}`);
    }

    return edge.Edge();
  } else if (
    arc.center &&
    arc.radius !== undefined &&
    arc.startAngle !== undefined &&
    arc.endAngle !== undefined
  ) {
    // Center-radius-angle arc
    const center = sketchPointTo3D(ctx, arc.center, plane);
    const normal = getSketchPlaneNormal(ctx, plane);

    // Create circle then trim to arc
    const ax2 = new oc.gp_Ax2_1();
    ax2.SetLocation(center);
    ax2.SetDirection(normal);
    const circle = new oc.gp_Circ_2(ax2, arc.radius);
    const arcGeom = new oc.GC_MakeArcOfCircle_1(circle, arc.startAngle, arc.endAngle, true);
    if (!arcGeom.IsDone()) {
      throw new Error(`GC_MakeArcOfCircle failed: ${arcGeom.Status()}`);
    }

    const edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(arcGeom.Value().get()));
    if (!edge.IsDone()) {
      throw new Error(`BRepBuilderAPI_MakeEdge failed: ${edge.Error()}`);
    }

    return edge.Edge();
  }

  throw new Error('Invalid arc definition');
}

/**
 * Build wire from rectangle (using MakePolygon for guaranteed connectivity)
 * @param ctx Worker context
 * @param rect Rectangle element
 * @param plane Sketch plane
 * @returns Wire containing the rectangle
 */
export function buildRectangleWire(
  ctx: WorkerContext,
  rect: SketchElement & { type: 'rectangle' },
  plane: SketchPlane
): TopoDS_Wire {
  const { oc } = ctx;
  const p1 = sketchPointTo3D(ctx, rect.corner1, plane);
  const p2 = sketchPointTo3D(ctx, { x: rect.corner2.x, y: rect.corner1.y }, plane);
  const p3 = sketchPointTo3D(ctx, rect.corner2, plane);
  const p4 = sketchPointTo3D(ctx, { x: rect.corner1.x, y: rect.corner2.y }, plane);

  // Use BRepBuilderAPI_MakePolygon for connected line segments
  // This ensures proper vertex sharing and connectivity
  const polygonBuilder = new oc.BRepBuilderAPI_MakePolygon_1();
  polygonBuilder.Add_1(p1);
  polygonBuilder.Add_1(p2);
  polygonBuilder.Add_1(p3);
  polygonBuilder.Add_1(p4);
  polygonBuilder.Close(); // Close the polygon back to p1

  if (!polygonBuilder.IsDone()) {
    throw new Error('BRepBuilderAPI_MakePolygon failed for rectangle');
  }

  return polygonBuilder.Wire();
}

/**
 * Build wire from polygon (using MakePolygon for guaranteed connectivity)
 * @param ctx Worker context
 * @param polygon Polygon element
 * @param plane Sketch plane
 * @returns Wire containing the polygon
 */
export function buildPolygonWire(
  ctx: WorkerContext,
  polygon: SketchElement & { type: 'polygon' },
  plane: SketchPlane
): TopoDS_Wire {
  const { oc } = ctx;
  const points = polygon.points.map(p => sketchPointTo3D(ctx, p, plane));

  // Use BRepBuilderAPI_MakePolygon for connected line segments
  const polygonBuilder = new oc.BRepBuilderAPI_MakePolygon_1();

  for (const point of points) {
    polygonBuilder.Add_1(point);
  }

  // Close the polygon
  polygonBuilder.Close();

  if (!polygonBuilder.IsDone()) {
    throw new Error('BRepBuilderAPI_MakePolygon failed for polygon');
  }

  return polygonBuilder.Wire();
}

/**
 * Extract edges from a wire (for multi-element sketch combination)
 * @param ctx Worker context
 * @param wire Wire to extract edges from
 * @returns Array of edges
 */
function extractEdgesFromWire(ctx: WorkerContext, wire: TopoDS_Wire): TopoDS_Edge[] {
  const { oc } = ctx;
  const edges: TopoDS_Edge[] = [];

  const edgeExplorer = new oc.TopExp_Explorer_2(
    wire,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  for (; edgeExplorer.More(); edgeExplorer.Next()) {
    const edge = oc.TopoDS.Edge_1(edgeExplorer.Current());
    edges.push(edge);
  }

  return edges;
}

/**
 * Build an ellipse edge from sketch ellipse
 * @param ctx Worker context
 * @param ellipse Ellipse element
 * @param plane Sketch plane
 * @returns Ellipse edge
 */
export function buildEllipseEdge(
  ctx: WorkerContext,
  ellipse: SketchElement & { type: 'ellipse' },
  plane: SketchPlane
): TopoDS_Edge {
  const { oc } = ctx;
  const center = sketchPointTo3D(ctx, ellipse.center, plane);
  const normal = getSketchPlaneNormal(ctx, plane);

  // Create a coordinate system for the ellipse
  // TODO: Handle rotation properly
  const ax2 = new oc.gp_Ax2_1();
  ax2.SetLocation(center);
  ax2.SetDirection(normal);

  const ellipseGeom = new oc.GC_MakeEllipse_2(ax2, ellipse.majorRadius, ellipse.minorRadius);
  if (!ellipseGeom.IsDone()) {
    throw new Error(`GC_MakeEllipse failed: ${ellipseGeom.Status()}`);
  }

  const edge = new oc.BRepBuilderAPI_MakeEdge_23(new oc.Handle_Geom_Curve_2(ellipseGeom.Value().get()));
  if (!edge.IsDone()) {
    throw new Error(`BRepBuilderAPI_MakeEdge failed: ${edge.Error()}`);
  }

  return edge.Edge();
}

/**
 * Build a spline edge from sketch spline
 * @param ctx Worker context
 * @param spline Spline element
 * @param plane Sketch plane
 * @returns Spline edge
 */
export function buildSplineEdge(
  ctx: WorkerContext,
  spline: SketchElement & { type: 'spline' },
  plane: SketchPlane
): TopoDS_Edge {
  const { oc } = ctx;
  const points = spline.points.map(p => sketchPointTo3D(ctx, p, plane));
  const pointArray = new oc.TColgp_Array1OfPnt_2(1, points.length);

  for (let i = 0; i < points.length; i++) {
    pointArray.SetValue(i + 1, points[i]);
  }

  const splineGeom = new oc.GeomAPI_PointsToBSpline_2(
    pointArray,
    3, // min degree
    8, // max degree
    oc.GeomAbs_Shape.GeomAbs_C2,
    1.0e-3
  );
  if (!splineGeom.IsDone()) {
    throw new Error('GeomAPI_PointsToBSpline failed');
  }

  const edge = new oc.BRepBuilderAPI_MakeEdge_23(new oc.Handle_Geom_Curve_2(splineGeom.Curve().get()));
  if (!edge.IsDone()) {
    throw new Error(`BRepBuilderAPI_MakeEdge failed: ${edge.Error()}`);
  }

  return edge.Edge();
}

/**
 * Build a wire from sketch elements
 * @param ctx Worker context
 * @param elements Array of sketch elements
 * @param plane Sketch plane
 * @returns Wire combining all elements
 */
export function buildSketchWire(
  ctx: WorkerContext,
  elements: SketchElement[],
  plane: SketchPlane
): TopoDS_Wire {
  const { oc } = ctx;

  // Special case: single rectangle or polygon - use MakePolygon for guaranteed connectivity
  if (elements.length === 1) {
    if (elements[0].type === 'rectangle') {
      return buildRectangleWire(ctx, elements[0] as SketchElement & { type: 'rectangle' }, plane);
    }
    if (elements[0].type === 'polygon') {
      return buildPolygonWire(ctx, elements[0] as SketchElement & { type: 'polygon' }, plane);
    }
  }

  // General case: build edges and combine into wire
  const edges: TopoDS_Edge[] = [];

  for (const element of elements) {
    switch (element.type) {
      case 'line':
        edges.push(buildLineEdge(ctx, element as SketchElement & { type: 'line' }, plane));
        break;
      case 'circle':
        edges.push(buildCircleEdge(ctx, element as SketchElement & { type: 'circle' }, plane));
        break;
      case 'arc':
        edges.push(buildArcEdge(ctx, element as SketchElement & { type: 'arc' }, plane));
        break;
      case 'rectangle':
        // For multi-element sketches, extract wire from rectangle and get its edges
        const rectWire = buildRectangleWire(ctx, element as SketchElement & { type: 'rectangle' }, plane);
        const rectEdges = extractEdgesFromWire(ctx, rectWire);
        edges.push(...rectEdges);
        break;
      case 'polygon':
        // For multi-element sketches, extract wire from polygon and get its edges
        const polyWire = buildPolygonWire(ctx, element as SketchElement & { type: 'polygon' }, plane);
        const polyEdges = extractEdgesFromWire(ctx, polyWire);
        edges.push(...polyEdges);
        break;
      case 'ellipse':
        edges.push(buildEllipseEdge(ctx, element as SketchElement & { type: 'ellipse' }, plane));
        break;
      case 'spline':
        edges.push(buildSplineEdge(ctx, element as SketchElement & { type: 'spline' }, plane));
        break;
      case 'bezier':
        // TODO: Implement Bezier curves
        console.warn('Bezier curves not yet implemented');
        break;
    }
  }

  // Build wire from edges
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();

  for (let i = 0; i < edges.length; i++) {
    wireBuilder.Add_1(edges[i]);

    // Check after each edge addition for better error diagnostics
    if (!wireBuilder.IsDone()) {
      const errorMsg = decodeWireError(ctx, wireBuilder.Error());
      throw new Error(
        `BRepBuilderAPI_MakeWire failed after adding edge ${i + 1}/${edges.length}: ${errorMsg}`
      );
    }
  }

  return wireBuilder.Wire();
}
