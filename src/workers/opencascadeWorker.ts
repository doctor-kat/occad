/**
 * OpenCascade.js Web Worker
 *
 * Loads the OpenCascade WASM module, builds parametric CAD models using the
 * raw OpenCascade API, tessellates them, and sends mesh + edge data back to
 * the main thread via transferable ArrayBuffers.
 *
 * Now supports parametric feature history with sketches, extrude, revolve, and boolean operations.
 */

import type {
  WorkerRequest,
  WorkerResponse,
  SketchElement,
  SketchPlane,
  Point2D,
  Point3D,
  Vector3D,
  ExtrudeParams,
  RevolveParams,
  PrimitiveBoxParams,
  MeshData,
  SketchEdgeData,
} from '../types/cad';

let oc: any = null;

/** Storage for OpenCascade shapes by ID */
const shapeStorage = new Map<string, any>();

/** Counter for generating unique shape IDs */
let shapeIdCounter = 0;

// ---------------------------------------------------------------------------
// Initialise the OpenCascade WASM module
// ---------------------------------------------------------------------------
async function init() {
  postMessage({ type: "progress", message: "Loading OpenCascade WASM…" });

  try {
    const module = await import("opencascade.js");
    const initOpenCascade = module.default;

    if (!initOpenCascade) {
      throw new Error("initOpenCascade is undefined - module.default is missing");
    }

    oc = await initOpenCascade();
    postMessage({ type: "ready" });
  } catch (err: any) {
    postMessage({ type: "error", error: `Failed to init OpenCascade: ${err.message ?? err}` });
  }
}

// ---------------------------------------------------------------------------
// Build the classic OCC bottle shape (translated from the C++ tutorial)
// ---------------------------------------------------------------------------
function buildBottle(params: { width: number; height: number; thickness: number }) {
  const { width, height, thickness } = params;

  // ---- Profile : Support Points ----
  const aPnt1 = new oc.gp_Pnt_3(-width / 2, 0, 0);
  const aPnt2 = new oc.gp_Pnt_3(-width / 2, -thickness / 4, 0);
  const aPnt3 = new oc.gp_Pnt_3(0, -thickness / 2, 0);
  const aPnt4 = new oc.gp_Pnt_3(width / 2, -thickness / 4, 0);
  const aPnt5 = new oc.gp_Pnt_3(width / 2, 0, 0);

  // ---- Profile : Geometry ----
  const anArcOfCircle = new oc.GC_MakeArcOfCircle_4(aPnt2, aPnt3, aPnt4);
  const aSegment1 = new oc.GC_MakeSegment_1(aPnt1, aPnt2);
  const aSegment2 = new oc.GC_MakeSegment_1(aPnt4, aPnt5);

  // ---- Profile : Topology ----
  const anEdge1 = new oc.BRepBuilderAPI_MakeEdge_24(
    new oc.Handle_Geom_Curve_2(aSegment1.Value().get()),
  );
  const anEdge2 = new oc.BRepBuilderAPI_MakeEdge_24(
    new oc.Handle_Geom_Curve_2(anArcOfCircle.Value().get()),
  );
  const anEdge3 = new oc.BRepBuilderAPI_MakeEdge_24(
    new oc.Handle_Geom_Curve_2(aSegment2.Value().get()),
  );
  const aWire = new oc.BRepBuilderAPI_MakeWire_4(
    anEdge1.Edge(),
    anEdge2.Edge(),
    anEdge3.Edge(),
  );

  // ---- Complete profile via mirror ----
  const xAxis = oc.gp.OX();
  const aTrsf = new oc.gp_Trsf_1();
  aTrsf.SetMirror_2(xAxis);
  const aBRepTrsf = new oc.BRepBuilderAPI_Transform_2(aWire.Wire(), aTrsf, false);
  const aMirroredShape = aBRepTrsf.Shape();

  const mkWire = new oc.BRepBuilderAPI_MakeWire_1();
  mkWire.Add_2(aWire.Wire());
  mkWire.Add_2(oc.TopoDS.Wire_1(aMirroredShape));
  const myWireProfile = mkWire.Wire();

  // ---- Body : Prism the profile ----
  const myFaceProfile = new oc.BRepBuilderAPI_MakeFace_15(myWireProfile, false);
  const aPrismVec = new oc.gp_Vec_4(0, 0, height);
  let myBody = new oc.BRepPrimAPI_MakePrism_1(myFaceProfile.Face(), aPrismVec, false, true);

  // ---- Body : Apply Fillets ----
  const mkFillet = new oc.BRepFilletAPI_MakeFillet(
    myBody.Shape(),
    oc.ChFi3d_FilletShape.ChFi3d_Rational,
  );
  const anEdgeExplorer = new oc.TopExp_Explorer_2(
    myBody.Shape(),
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  while (anEdgeExplorer.More()) {
    const anEdge = oc.TopoDS.Edge_1(anEdgeExplorer.Current());
    mkFillet.Add_2(thickness / 12, anEdge);
    anEdgeExplorer.Next();
  }
  myBody = mkFillet;

  // ---- Body : Add the Neck ----
  const neckLocation = new oc.gp_Pnt_3(0, 0, height);
  const neckAxis = oc.gp.DZ();
  const neckAx2 = new oc.gp_Ax2_3(neckLocation, neckAxis);

  const myNeckRadius = thickness / 4;
  const myNeckHeight = height / 10;

  const MKCylinder = new oc.BRepPrimAPI_MakeCylinder_3(
    neckAx2,
    myNeckRadius,
    myNeckHeight,
  );
  const myNeck = MKCylinder.Shape();

  myBody = new oc.BRepAlgoAPI_Fuse_3(
    myBody.Shape(),
    myNeck,
    new oc.Message_ProgressRange_1(),
  );

  // ---- Body : Hollow (Shell) ----
  let faceToRemove: any;
  let zMax = -1;
  const aFaceExplorer = new oc.TopExp_Explorer_2(
    myBody.Shape(),
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; aFaceExplorer.More(); aFaceExplorer.Next()) {
    const aFace = oc.TopoDS.Face_1(aFaceExplorer.Current());
    const aSurface = oc.BRep_Tool.Surface_2(aFace);
    if (aSurface.get().$$.ptrType.name === "Geom_Plane*") {
      const aPlane = new oc.Handle_Geom_Plane_2(aSurface.get()).get();
      const aPnt = aPlane.Location();
      const aZ = aPnt.Z();
      if (aZ > zMax) {
        zMax = aZ;
        faceToRemove = new oc.TopExp_Explorer_2(
          aFace,
          oc.TopAbs_ShapeEnum.TopAbs_FACE,
          oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
        ).Current();
      }
    }
  }

  const facesToRemove = new oc.TopTools_ListOfShape_1();
  facesToRemove.Append_1(faceToRemove);
  const solidShape = myBody.Shape();
  const mkThick = new oc.BRepOffsetAPI_MakeThickSolid();
  mkThick.MakeThickSolidByJoin(
    solidShape,
    facesToRemove,
    -thickness / 50,
    1.0e-3,
    oc.BRepOffset_Mode.BRepOffset_Skin,
    false,
    false,
    oc.GeomAbs_JoinType.GeomAbs_Arc,
    false,
    new oc.Message_ProgressRange_1(),
  );

  // Rotate bottle upright (Z-up → Y-up for Three.js)
  const tf = new oc.gp_Trsf_1();
  tf.SetRotation_1(
    new oc.gp_Ax1_2(new oc.gp_Pnt_1(), new oc.gp_Dir_4(1, 0, 0)),
    -Math.PI / 2,
  );
  const loc = new oc.TopLoc_Location_2(tf);

  return mkThick.Shape().Moved(loc, false);
}

// ---------------------------------------------------------------------------
// Sketch Geometry Builders
// ---------------------------------------------------------------------------

/** Convert 2D sketch point to 3D point on sketch plane */
function sketchPointTo3D(point2D: Point2D, plane: SketchPlane): any {
  const offset = plane.offset || 0;

  switch (plane.type) {
    case 'xy':
      return new oc.gp_Pnt_3(point2D.x, point2D.y, offset);
    case 'xz':
      return new oc.gp_Pnt_3(point2D.x, offset, point2D.y);
    case 'yz':
      return new oc.gp_Pnt_3(offset, point2D.x, point2D.y);
    case 'custom':
      if (plane.origin && plane.normal) {
        // Create a local coordinate system on the custom plane
        const origin = new oc.gp_Pnt_3(plane.origin.x, plane.origin.y, plane.origin.z);
        const normal = new oc.gp_Dir_4(plane.normal.x, plane.normal.y, plane.normal.z);

        // Create an arbitrary perpendicular vector for X axis
        let xDir: any;
        if (Math.abs(plane.normal.x) < 0.9) {
          const xVec = new oc.gp_Vec_4(1, 0, 0);
          const normalVec = new oc.gp_Vec_4(plane.normal.x, plane.normal.y, plane.normal.z);
          const crossVec = xVec.Crossed(normalVec);
          xDir = new oc.gp_Dir_1(crossVec);
        } else {
          const yVec = new oc.gp_Vec_4(0, 1, 0);
          const normalVec = new oc.gp_Vec_4(plane.normal.x, plane.normal.y, plane.normal.z);
          const crossVec = yVec.Crossed(normalVec);
          xDir = new oc.gp_Dir_1(crossVec);
        }

        // Create coordinate system
        const ax2 = new oc.gp_Ax2_2(origin, normal, xDir);

        // Transform 2D point to 3D using the local coordinate system
        const pnt2d = new oc.gp_Pnt2d_2(point2D.x, point2D.y);
        const pln = new oc.gp_Pln_3(ax2);

        // Convert 2D point to 3D point on the plane
        const u = point2D.x;
        const v = point2D.y;

        // Get the X and Y directions of the plane
        const xAxis = pln.XAxis();
        const yAxis = pln.YAxis();

        // Calculate 3D point: origin + u*xDir + v*yDir
        const xVec = xAxis.Direction();
        const yVec = yAxis.Direction();
        const pos = pln.Location();

        const x = pos.X() + u * xVec.X() + v * yVec.X();
        const y = pos.Y() + u * xVec.Y() + v * yVec.Y();
        const z = pos.Z() + u * xVec.Z() + v * yVec.Z();

        return new oc.gp_Pnt_3(x, y, z);
      }
      // Fallback to XY plane
      return new oc.gp_Pnt_3(point2D.x, point2D.y, offset);
    default:
      return new oc.gp_Pnt_3(point2D.x, point2D.y, offset);
  }
}

/** Get sketch plane normal vector */
function getSketchPlaneNormal(plane: SketchPlane): any {
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
    default:
      return new oc.gp_Dir_4(0, 0, 1);
  }
}

/** Build a line edge from sketch line */
function buildLineEdge(line: SketchElement & { type: 'line' }, plane: SketchPlane): any {
  const p1 = sketchPointTo3D(line.start, plane);
  const p2 = sketchPointTo3D(line.end, plane);

  const segment = new oc.GC_MakeSegment_1(p1, p2);
  const edge = new oc.BRepBuilderAPI_MakeEdge_24(
    new oc.Handle_Geom_Curve_2(segment.Value().get())
  );

  return edge.Edge();
}

/** Build a circle edge from sketch circle */
function buildCircleEdge(circle: SketchElement & { type: 'circle' }, plane: SketchPlane): any {
  const center = sketchPointTo3D(circle.center, plane);
  const normal = getSketchPlaneNormal(plane);

  const circleGeom = new oc.GC_MakeCircle_6(center, normal, circle.radius);
  const edge = new oc.BRepBuilderAPI_MakeEdge_23(
    new oc.Handle_Geom_Curve_2(circleGeom.Value().get())
  );

  return edge.Edge();
}

/** Build an arc edge from sketch arc */
function buildArcEdge(arc: SketchElement & { type: 'arc' }, plane: SketchPlane): any {
  if (arc.points) {
    // Three-point arc
    const p1 = sketchPointTo3D(arc.points[0], plane);
    const p2 = sketchPointTo3D(arc.points[1], plane);
    const p3 = sketchPointTo3D(arc.points[2], plane);

    const arcGeom = new oc.GC_MakeArcOfCircle_4(p1, p2, p3);
    const edge = new oc.BRepBuilderAPI_MakeEdge_24(
      new oc.Handle_Geom_Curve_2(arcGeom.Value().get())
    );

    return edge.Edge();
  } else if (arc.center && arc.radius !== undefined && arc.startAngle !== undefined && arc.endAngle !== undefined) {
    // Center-radius-angle arc
    const center = sketchPointTo3D(arc.center, plane);
    const normal = getSketchPlaneNormal(plane);

    // Create circle then trim to arc
    const circle = new oc.gp_Circ_2(new oc.gp_Ax2_3(center, normal), arc.radius);
    const arcGeom = new oc.GC_MakeArcOfCircle_1(circle, arc.startAngle, arc.endAngle, true);
    const edge = new oc.BRepBuilderAPI_MakeEdge_24(
      new oc.Handle_Geom_Curve_2(arcGeom.Value().get())
    );

    return edge.Edge();
  }

  throw new Error('Invalid arc definition');
}

/** Build edges from rectangle (4 lines) */
function buildRectangleEdges(rect: SketchElement & { type: 'rectangle' }, plane: SketchPlane): any[] {
  const p1 = sketchPointTo3D(rect.corner1, plane);
  const p2 = sketchPointTo3D({ x: rect.corner2.x, y: rect.corner1.y }, plane);
  const p3 = sketchPointTo3D(rect.corner2, plane);
  const p4 = sketchPointTo3D({ x: rect.corner1.x, y: rect.corner2.y }, plane);

  const edges: any[] = [];
  const points = [p1, p2, p3, p4, p1]; // Close the rectangle

  for (let i = 0; i < 4; i++) {
    const segment = new oc.GC_MakeSegment_1(points[i], points[i + 1]);
    const edge = new oc.BRepBuilderAPI_MakeEdge_24(
      new oc.Handle_Geom_Curve_2(segment.Value().get())
    );
    edges.push(edge.Edge());
  }

  return edges;
}

/** Build edges from polygon */
function buildPolygonEdges(polygon: SketchElement & { type: 'polygon' }, plane: SketchPlane): any[] {
  const edges: any[] = [];
  const points = polygon.points.map(p => sketchPointTo3D(p, plane));

  // Close the polygon if not already closed
  const isClosed =
    Math.abs(points[0].X() - points[points.length - 1].X()) < 0.001 &&
    Math.abs(points[0].Y() - points[points.length - 1].Y()) < 0.001 &&
    Math.abs(points[0].Z() - points[points.length - 1].Z()) < 0.001;

  if (!isClosed) {
    points.push(points[0]);
  }

  for (let i = 0; i < points.length - 1; i++) {
    const segment = new oc.GC_MakeSegment_1(points[i], points[i + 1]);
    const edge = new oc.BRepBuilderAPI_MakeEdge_24(
      new oc.Handle_Geom_Curve_2(segment.Value().get())
    );
    edges.push(edge.Edge());
  }

  return edges;
}

/** Build an ellipse edge from sketch ellipse */
function buildEllipseEdge(ellipse: SketchElement & { type: 'ellipse' }, plane: SketchPlane): any {
  const center = sketchPointTo3D(ellipse.center, plane);
  const normal = getSketchPlaneNormal(plane);

  // Create a coordinate system for the ellipse
  // TODO: Handle rotation properly
  const xDir = new oc.gp_Dir_4(1, 0, 0);
  const ax2 = new oc.gp_Ax2_3(center, normal);

  const ellipseGeom = new oc.GC_MakeEllipse_2(ax2, ellipse.majorRadius, ellipse.minorRadius);
  const edge = new oc.BRepBuilderAPI_MakeEdge_23(
    new oc.Handle_Geom_Curve_2(ellipseGeom.Value().get())
  );

  return edge.Edge();
}

/** Build a spline edge from sketch spline */
function buildSplineEdge(spline: SketchElement & { type: 'spline' }, plane: SketchPlane): any {
  const points = spline.points.map(p => sketchPointTo3D(p, plane));
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

  const edge = new oc.BRepBuilderAPI_MakeEdge_23(
    new oc.Handle_Geom_Curve_2(splineGeom.Curve().get())
  );

  return edge.Edge();
}

/** Build a wire from sketch elements */
function buildSketchWire(elements: SketchElement[], plane: SketchPlane): any {
  const edges: any[] = [];

  for (const element of elements) {
    switch (element.type) {
      case 'line':
        edges.push(buildLineEdge(element as any, plane));
        break;
      case 'circle':
        edges.push(buildCircleEdge(element as any, plane));
        break;
      case 'arc':
        edges.push(buildArcEdge(element as any, plane));
        break;
      case 'rectangle':
        edges.push(...buildRectangleEdges(element as any, plane));
        break;
      case 'polygon':
        edges.push(...buildPolygonEdges(element as any, plane));
        break;
      case 'ellipse':
        edges.push(buildEllipseEdge(element as any, plane));
        break;
      case 'spline':
        edges.push(buildSplineEdge(element as any, plane));
        break;
      case 'bezier':
        // TODO: Implement Bezier curves
        console.warn('Bezier curves not yet implemented');
        break;
    }
  }

  // Build wire from edges
  const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
  for (const edge of edges) {
    wireBuilder.Add_1(edge);
  }

  return wireBuilder.Wire();
}

// ---------------------------------------------------------------------------
// Tessellate a TopoDS_Shape and extract mesh buffers
// ---------------------------------------------------------------------------
function tessellate(shape: any, linearDeflection = 0.1, angularDeflection = 0.5) {
  // Perform incremental meshing
  new oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, false, angularDeflection, false);

  const faceVertices: number[] = [];
  const faceIndices: number[] = [];
  const faceMapping: number[] = []; // Maps each triangle to its parent CAD face
  const edgeVertices: number[] = [];

  let vertexOffset = 0;
  let cadFaceId = 0; // Unique ID for each CAD face

  // ---- Extract triangulated faces ----
  const faceExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  for (; faceExplorer.More(); faceExplorer.Next()) {
    const face = oc.TopoDS.Face_1(faceExplorer.Current());
    const location = new oc.TopLoc_Location_1();
    const handleTriangulation = oc.BRep_Tool.Triangulation(face, location, 0);

    if (handleTriangulation.IsNull()) continue;

    const triangulation = handleTriangulation.get();
    const nNodes = triangulation.NbNodes();
    const nTriangles = triangulation.NbTriangles();
    const transform = location.Transformation();
    const isReversed =
      face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED;

    // Vertices (apply location transform)
    for (let i = 1; i <= nNodes; i++) {
      const pnt = triangulation.Node(i).Transformed(transform);
      faceVertices.push(pnt.X(), pnt.Y(), pnt.Z());
    }

    // Triangle indices (flip winding for reversed faces)
    for (let i = 1; i <= nTriangles; i++) {
      const tri = triangulation.Triangle(i);
      let n1 = tri.Value(1);
      let n2 = tri.Value(2);
      let n3 = tri.Value(3);

      if (isReversed) {
        [n1, n2] = [n2, n1];
      }

      faceIndices.push(
        n1 - 1 + vertexOffset,
        n2 - 1 + vertexOffset,
        n3 - 1 + vertexOffset,
      );

      // Map this triangle to the current CAD face
      faceMapping.push(cadFaceId);
    }

    vertexOffset += nNodes;
    cadFaceId++; // Increment for next CAD face
  }

  // ---- Extract edge polylines ----
  // Use TopExp.MapShapes_1 to get unique edges (HashCode is unreliable for deduplication)
  const edgeMap = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, edgeMap);

  const edgeCount = edgeMap.Extent();

  for (let i = 1; i <= edgeCount; i++) {
    const edge = oc.TopoDS.Edge_1(edgeMap.FindKey(i));

    const location = new oc.TopLoc_Location_1();
    const handlePoly = oc.BRep_Tool.Polygon3D(edge, location);

    if (!handlePoly.IsNull()) {
      const poly = handlePoly.get();
      const transform = location.Transformation();
      const nbNodes = poly.NbNodes();

      for (let j = 1; j < nbNodes; j++) {
        const p1 = poly.Nodes().Value(j).Transformed(transform);
        const p2 = poly.Nodes().Value(j + 1).Transformed(transform);
        edgeVertices.push(p1.X(), p1.Y(), p1.Z());
        edgeVertices.push(p2.X(), p2.Y(), p2.Z());
      }
    } else {
      // Fall back: discretize the edge curve directly
      try {
        const adaptorCurve = new oc.BRepAdaptor_Curve_2(edge);
        const tangDef = new oc.GCPnts_TangentialDeflection_2(
          adaptorCurve,
          angularDeflection,
          linearDeflection,
          2,    // minimum points
          1e-9, // U tolerance
          1e-7, // angular tolerance
        );
        const n = tangDef.NbPoints();
        for (let j = 1; j < n; j++) {
          const p1 = tangDef.Value(j);
          const p2 = tangDef.Value(j + 1);
          edgeVertices.push(p1.X(), p1.Y(), p1.Z());
          edgeVertices.push(p2.X(), p2.Y(), p2.Z());
        }
      } catch {
        // Skip edges that can't be discretized
      }
    }
  }

  // Compute normals (simple per-vertex normals)
  const faceNormals: number[] = new Array(faceVertices.length).fill(0);

  // Simple normal computation: average face normals for each vertex
  for (let i = 0; i < faceIndices.length; i += 3) {
    const i1 = faceIndices[i] * 3;
    const i2 = faceIndices[i + 1] * 3;
    const i3 = faceIndices[i + 2] * 3;

    const v1x = faceVertices[i2] - faceVertices[i1];
    const v1y = faceVertices[i2 + 1] - faceVertices[i1 + 1];
    const v1z = faceVertices[i2 + 2] - faceVertices[i1 + 2];

    const v2x = faceVertices[i3] - faceVertices[i1];
    const v2y = faceVertices[i3 + 1] - faceVertices[i1 + 1];
    const v2z = faceVertices[i3 + 2] - faceVertices[i1 + 2];

    // Cross product
    const nx = v1y * v2z - v1z * v2y;
    const ny = v1z * v2x - v1x * v2z;
    const nz = v1x * v2y - v1y * v2x;

    // Accumulate normals for each vertex
    for (const idx of [i1, i2, i3]) {
      faceNormals[idx] += nx;
      faceNormals[idx + 1] += ny;
      faceNormals[idx + 2] += nz;
    }
  }

  // Normalize
  for (let i = 0; i < faceNormals.length; i += 3) {
    const len = Math.sqrt(
      faceNormals[i] ** 2 + faceNormals[i + 1] ** 2 + faceNormals[i + 2] ** 2
    );
    if (len > 0) {
      faceNormals[i] /= len;
      faceNormals[i + 1] /= len;
      faceNormals[i + 2] /= len;
    }
  }

  // Create edge indices (pairs of vertices)
  const edgeIndices: number[] = [];
  for (let i = 0; i < edgeVertices.length / 3; i++) {
    edgeIndices.push(i);
  }

  return {
    faceVertices: new Float32Array(faceVertices),
    faceNormals: new Float32Array(faceNormals),
    faceIndices: new Uint32Array(faceIndices),
    edgeVertices: new Float32Array(edgeVertices),
    edgeIndices: new Uint32Array(edgeIndices),
    faceMapping: new Uint32Array(faceMapping),
    edgeCount,
  };
}

// ---------------------------------------------------------------------------
// Operation Handlers
// ---------------------------------------------------------------------------

/** Handle buildSketch request */
function handleBuildSketch(sketchId: string, plane: SketchPlane, elements: SketchElement[]) {
  try {
    postMessage({ type: "progress", message: `Building sketch ${sketchId}...` });

    // Build wire from sketch elements
    const wire = buildSketchWire(elements, plane);

    // Create face from wire (if closed)
    let shape = wire;
    try {
      const face = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
      if (!face.IsDone()) {
        console.warn('Could not create face from wire, using wire only');
      } else {
        shape = face.Face();
      }
    } catch (err) {
      console.warn('Failed to create face from wire:', err);
    }

    // Store shape
    const shapeId = `sketch_${sketchId}_${shapeIdCounter++}`;
    shapeStorage.set(shapeId, shape);

    // Tessellate for visualization
    const meshData = tessellate(shape, 0.05, 0.3);

    const transferables = [
      meshData.faceVertices.buffer,
      meshData.faceNormals.buffer,
      meshData.faceIndices.buffer,
      meshData.edgeVertices.buffer,
      meshData.edgeIndices.buffer,
      meshData.faceMapping.buffer,
    ];

    postMessage(
      {
        type: "sketchBuilt",
        sketchId,
        geometry: { shapeId, shapeType: 'face' as const },
        meshData,
      },
      transferables as any
    );
  } catch (err: any) {
    postMessage({
      type: "error",
      message: `Failed to build sketch: ${err.message ?? err}`,
      featureId: sketchId,
    });
  }
}

/** Handle extrudeSketch request */
function handleExtrudeSketch(
  featureId: string,
  sketchId: string,
  params: ExtrudeParams
) {
  try {
    postMessage({ type: "progress", message: `Extruding sketch ${sketchId}...` });

    // Find sketch shape
    const sketchShapeId = Array.from(shapeStorage.keys()).find(id => id.includes(sketchId));
    if (!sketchShapeId) {
      throw new Error(`Sketch ${sketchId} not found in storage`);
    }

    const sketchShape = shapeStorage.get(sketchShapeId);

    // Get or create face from wire
    let faceToExtrude = sketchShape;
    if (sketchShape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
      const face = new oc.BRepBuilderAPI_MakeFace_15(sketchShape, false);
      faceToExtrude = face.Face();
    }

    // Create extrusion vector
    const direction = params.direction || { x: 0, y: 0, z: 1 }; // Default to Z-up
    const extrudeVec = new oc.gp_Vec_4(
      direction.x * params.distance,
      direction.y * params.distance,
      direction.z * params.distance
    );

    // Perform extrusion
    const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
    let shape = prism.Shape();

    // Store shape
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    shapeStorage.set(shapeId, shape);

    // Tessellate for visualization
    const meshData = tessellate(shape, 0.1, 0.5);

    const transferables = [
      meshData.faceVertices.buffer,
      meshData.faceNormals.buffer,
      meshData.faceIndices.buffer,
      meshData.edgeVertices.buffer,
      meshData.edgeIndices.buffer,
      meshData.faceMapping.buffer,
    ];

    postMessage(
      {
        type: "featureBuilt",
        featureId,
        geometry: { shapeId, shapeType: 'solid' as const },
        meshData,
      },
      transferables as any
    );
  } catch (err: any) {
    postMessage({
      type: "error",
      message: `Failed to extrude sketch: ${err.message ?? err}`,
      featureId,
    });
  }
}

/** Handle revolveSketch request */
function handleRevolveSketch(
  featureId: string,
  sketchId: string,
  params: RevolveParams
) {
  try {
    postMessage({ type: "progress", message: `Revolving sketch ${sketchId}...` });

    // Find sketch shape
    const sketchShapeId = Array.from(shapeStorage.keys()).find(id => id.includes(sketchId));
    if (!sketchShapeId) {
      throw new Error(`Sketch ${sketchId} not found in storage`);
    }

    const sketchShape = shapeStorage.get(sketchShapeId);

    // Get or create face from wire
    let faceToRevolve = sketchShape;
    if (sketchShape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
      const face = new oc.BRepBuilderAPI_MakeFace_15(sketchShape, false);
      faceToRevolve = face.Face();
    }

    // Create axis of revolution
    const axisOrigin = new oc.gp_Pnt_3(
      params.axis.origin.x,
      params.axis.origin.y,
      params.axis.origin.z
    );
    const axisDir = new oc.gp_Dir_4(
      params.axis.direction.x,
      params.axis.direction.y,
      params.axis.direction.z
    );
    const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);

    // Perform revolution
    const angleRad = (params.angle * Math.PI) / 180;
    const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, angleRad, false);
    let shape = revol.Shape();

    // Store shape
    const shapeId = `feature_${featureId}_${shapeIdCounter++}`;
    shapeStorage.set(shapeId, shape);

    // Tessellate for visualization
    const meshData = tessellate(shape, 0.1, 0.5);

    const transferables = [
      meshData.faceVertices.buffer,
      meshData.faceNormals.buffer,
      meshData.faceIndices.buffer,
      meshData.edgeVertices.buffer,
      meshData.edgeIndices.buffer,
      meshData.faceMapping.buffer,
    ];

    postMessage(
      {
        type: "featureBuilt",
        featureId,
        geometry: { shapeId, shapeType: 'solid' as const },
        meshData,
      },
      transferables as any
    );
  } catch (err: any) {
    postMessage({
      type: "error",
      message: `Failed to revolve sketch: ${err.message ?? err}`,
      featureId,
    });
  }
}

/** Perform boolean operation on shapes */
function performBooleanOperation(
  operation: 'union' | 'intersect' | 'subtract',
  shape1: any,
  shape2: any
): any {
  const progressRange = new oc.Message_ProgressRange_1();

  switch (operation) {
    case 'union':
      return new oc.BRepAlgoAPI_Fuse_3(shape1, shape2, progressRange).Shape();
    case 'intersect':
      return new oc.BRepAlgoAPI_Common_3(shape1, shape2, progressRange).Shape();
    case 'subtract':
      return new oc.BRepAlgoAPI_Cut_3(shape1, shape2, progressRange).Shape();
    default:
      throw new Error(`Unknown boolean operation: ${operation}`);
  }
}

/** Extract edge vertices from a shape for wireframe rendering */
function extractEdgeVertices(shape: any, linearDeflection = 0.1, angularDeflection = 0.5): Float32Array {
  // Tessellate so edges have polygon data
  new oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, false, angularDeflection, false);

  const edgeVertices: number[] = [];

  // Use TopExp.MapShapes_1 to get unique edges (HashCode is unreliable for deduplication)
  const edgeMap = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, edgeMap);
  const edgeCount = edgeMap.Extent();

  for (let i = 1; i <= edgeCount; i++) {
    const edge = oc.TopoDS.Edge_1(edgeMap.FindKey(i));

    const location = new oc.TopLoc_Location_1();
    const handlePoly = oc.BRep_Tool.Polygon3D(edge, location);

    if (!handlePoly.IsNull()) {
      const poly = handlePoly.get();
      const transform = location.Transformation();
      const nbNodes = poly.NbNodes();
      for (let i = 1; i < nbNodes; i++) {
        const p1 = poly.Nodes().Value(i).Transformed(transform);
        const p2 = poly.Nodes().Value(i + 1).Transformed(transform);
        edgeVertices.push(p1.X(), p1.Y(), p1.Z());
        edgeVertices.push(p2.X(), p2.Y(), p2.Z());
      }
    } else {
      try {
        const adaptorCurve = new oc.BRepAdaptor_Curve_2(edge);
        const tangDef = new oc.GCPnts_TangentialDeflection_2(
          adaptorCurve, angularDeflection, linearDeflection, 2, 1e-9, 1e-7,
        );
        const n = tangDef.NbPoints();
        for (let i = 1; i < n; i++) {
          const p1 = tangDef.Value(i);
          const p2 = tangDef.Value(i + 1);
          edgeVertices.push(p1.X(), p1.Y(), p1.Z());
          edgeVertices.push(p2.X(), p2.Y(), p2.Z());
        }
      } catch {
        // Skip edges that can't be discretized
      }
    }
  }

  return new Float32Array(edgeVertices);
}

/** Handle full rebuild of project from feature history */
function handleRebuild(project: any) {
  try {
    postMessage({ type: "progress", message: "Starting full rebuild..." });

    // Clear existing shapes
    shapeStorage.clear();

    let currentBody: any = null;

    // First pass: Build all sketches
    for (const sketch of project.sketches) {
      try {
        postMessage({
          type: "rebuildProgress",
          progress: 0,
          currentFeatureId: sketch.id,
        });

        const wire = buildSketchWire(sketch.elements, sketch.plane);
        let shape = wire;

        try {
          const face = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
          if (face.IsDone()) {
            shape = face.Face();
          }
        } catch (err) {
          console.warn(`Could not create face for sketch ${sketch.id}`);
        }

        const shapeId = `sketch_${sketch.id}_${shapeIdCounter++}`;
        shapeStorage.set(shapeId, shape);
      } catch (err: any) {
        console.error(`Failed to rebuild sketch ${sketch.id}:`, err);
        postMessage({ type: "error", message: `Sketch failed: ${err.message ?? err}`, featureId: sketch.id });
      }
    }

    // Collect sketch edge data for wireframe rendering
    const sketchEdgesMap: Record<string, SketchEdgeData> = {};
    for (const sketch of project.sketches) {
      const sketchShapeId = Array.from(shapeStorage.keys()).find(id => id.includes(sketch.id));
      if (sketchShapeId) {
        try {
          const sketchShape = shapeStorage.get(sketchShapeId);
          const edgeVertices = extractEdgeVertices(sketchShape, 0.05, 0.3);
          if (edgeVertices.length > 0) {
            sketchEdgesMap[sketch.id] = { edgeVertices };
          }
        } catch (err) {
          // Non-fatal: skip edge extraction for this sketch
        }
      }
    }

    // Second pass: Build all features in order
    const totalFeatures = project.features.filter((f: any) => !f.isSuppressed).length;
    let processedFeatures = 0;

    for (const feature of project.features) {
      if (feature.isSuppressed) continue;

      try {
        postMessage({
          type: "rebuildProgress",
          progress: processedFeatures / totalFeatures,
          currentFeatureId: feature.id,
        });

        if (feature.type === 'extrude-boss' || feature.type === 'extruded-cut') {
          // Handle extrude features
          const sketchShapeId = Array.from(shapeStorage.keys()).find(id =>
            id.includes(feature.sketchId)
          );

          if (sketchShapeId) {
            const sketchShape = shapeStorage.get(sketchShapeId);
            let faceToExtrude = sketchShape;

            if (sketchShape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
              const face = new oc.BRepBuilderAPI_MakeFace_15(sketchShape, false);
              faceToExtrude = face.Face();
            }

            const params = feature.parameters as ExtrudeParams;
            const direction = params.direction || { x: 0, y: 0, z: 1 };
            const extrudeVec = new oc.gp_Vec_4(
              direction.x * params.distance,
              direction.y * params.distance,
              direction.z * params.distance
            );

            const prism = new oc.BRepPrimAPI_MakePrism_1(faceToExtrude, extrudeVec, false, true);
            let newShape = prism.Shape();

            // Apply boolean operation if we have an existing body
            if (currentBody) {
              if (feature.type === 'extrude-boss') {
                currentBody = performBooleanOperation('union', currentBody, newShape);
              } else if (feature.type === 'extruded-cut') {
                currentBody = performBooleanOperation('subtract', currentBody, newShape);
              }
            } else {
              currentBody = newShape;
            }

            const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
            shapeStorage.set(shapeId, currentBody);
          }
        } else if (feature.type === 'revolved-boss' || feature.type === 'revolved-cut') {
          // Handle revolve features
          const sketchShapeId = Array.from(shapeStorage.keys()).find(id =>
            id.includes(feature.sketchId)
          );

          if (sketchShapeId) {
            const sketchShape = shapeStorage.get(sketchShapeId);
            let faceToRevolve = sketchShape;

            if (sketchShape.ShapeType() === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
              const face = new oc.BRepBuilderAPI_MakeFace_15(sketchShape, false);
              faceToRevolve = face.Face();
            }

            const params = feature.parameters as RevolveParams;
            const axisOrigin = new oc.gp_Pnt_3(
              params.axis.origin.x,
              params.axis.origin.y,
              params.axis.origin.z
            );
            const axisDir = new oc.gp_Dir_4(
              params.axis.direction.x,
              params.axis.direction.y,
              params.axis.direction.z
            );
            const axis = new oc.gp_Ax1_2(axisOrigin, axisDir);

            const angleRad = (params.angle * Math.PI) / 180;
            const revol = new oc.BRepPrimAPI_MakeRevol_1(faceToRevolve, axis, angleRad, false);
            let newShape = revol.Shape();

            // Apply boolean operation if we have an existing body
            if (currentBody) {
              if (feature.type === 'revolved-boss') {
                currentBody = performBooleanOperation('union', currentBody, newShape);
              } else if (feature.type === 'revolved-cut') {
                currentBody = performBooleanOperation('subtract', currentBody, newShape);
              }
            } else {
              currentBody = newShape;
            }

            const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
            shapeStorage.set(shapeId, currentBody);
          }
        } else if (feature.type === 'box') {
          // Handle primitive box
          const params = feature.parameters as PrimitiveBoxParams;
          const center = params.center || { x: 0, y: 0, z: 0 };

          // Create box at origin first, then translate
          const dx = params.width;
          const dy = params.height;
          const dz = params.depth;

          // Create box with dimensions (positioned at origin corner)
          const box = new oc.BRepPrimAPI_MakeBox_1(dx, dy, dz);
          let newShape = box.Shape();

          // Translate to center if needed
          if (center.x !== 0 || center.y !== 0 || center.z !== 0) {
            const translation = new oc.gp_Vec_4(
              center.x - dx / 2,
              center.y - dy / 2,
              center.z + dz / 2  // OpenCascade creates box in positive Z
            );
            const transform = new oc.gp_Trsf_1();
            transform.SetTranslation_1(translation);
            const location = new oc.TopLoc_Location_2(transform);
            newShape = newShape.Moved(location, false);
          } else {
            // Center at origin
            const translation = new oc.gp_Vec_4(-dx / 2, -dy / 2, dz / 2);
            const transform = new oc.gp_Trsf_1();
            transform.SetTranslation_1(translation);
            const location = new oc.TopLoc_Location_2(transform);
            newShape = newShape.Moved(location, false);
          }

          // Apply boolean operation if we have an existing body
          if (currentBody) {
            currentBody = performBooleanOperation('union', currentBody, newShape);
          } else {
            currentBody = newShape;
          }

          const shapeId = `feature_${feature.id}_${shapeIdCounter++}`;
          shapeStorage.set(shapeId, currentBody);
        }

        processedFeatures++;
      } catch (err: any) {
        console.error(`Failed to rebuild feature ${feature.id}:`, err);
        postMessage({ type: "error", message: `Feature failed: ${err.message ?? err}`, featureId: feature.id });
      }
    }

    // Tessellate final body
    if (currentBody) {
      // Store the final body with a known ID for face geometry queries
      const finalShapeId = `rebuild_final_${shapeIdCounter++}`;
      shapeStorage.set(finalShapeId, currentBody);

      const meshData = tessellate(currentBody, 0.1, 0.5);

      const transferables: ArrayBuffer[] = [
        meshData.faceVertices.buffer,
        meshData.faceNormals.buffer,
        meshData.faceIndices.buffer,
        meshData.edgeVertices.buffer,
        meshData.edgeIndices.buffer,
        meshData.faceMapping.buffer,
      ];

      // Add sketch edge buffers to transferables
      for (const edge of Object.values(sketchEdgesMap)) {
        transferables.push(edge.edgeVertices.buffer);
      }

      postMessage(
        { type: "rebuildComplete", meshData, shapeId: finalShapeId, sketchEdges: sketchEdgesMap },
        transferables as any,
      );
    } else {
      // No features to build - this is valid when project only has sketches or is empty
      // Return empty mesh data instead of an error
      const emptyMeshData: MeshData = {
        faceVertices: new Float32Array(0),
        faceNormals: new Float32Array(0),
        faceIndices: new Uint32Array(0),
        edgeVertices: new Float32Array(0),
        edgeIndices: new Uint32Array(0),
        faceMapping: new Uint32Array(0),
      };

      const transferables: ArrayBuffer[] = [];
      for (const edge of Object.values(sketchEdgesMap)) {
        transferables.push(edge.edgeVertices.buffer);
      }

      postMessage(
        { type: "rebuildComplete", meshData: emptyMeshData, shapeId: '', sketchEdges: sketchEdgesMap },
        transferables as any,
      );
    }
  } catch (err: any) {
    postMessage({
      type: "error",
      message: `Rebuild failed: ${err.message ?? err}`,
    });
  }
}

/** Handle getFaceGeometry request - extract plane origin and normal from a face */
function handleGetFaceGeometry(faceId: number, shapeId: string) {
  try {
    postMessage({ type: "progress", message: `Getting face geometry for face ${faceId}...` });

    // Get the shape from storage
    const shape = shapeStorage.get(shapeId);
    if (!shape) {
      throw new Error(`Shape ${shapeId} not found in storage`);
    }

    // Iterate through faces to find the one with matching ID
    const faceExplorer = new oc.TopExp_Explorer_2(
      shape,
      oc.TopAbs_ShapeEnum.TopAbs_FACE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );

    let currentFaceId = 0;
    let targetFace: any = null;

    for (; faceExplorer.More(); faceExplorer.Next()) {
      if (currentFaceId === faceId) {
        targetFace = oc.TopoDS.Face_1(faceExplorer.Current());
        break;
      }
      currentFaceId++;
    }

    if (!targetFace) {
      throw new Error(`Face ${faceId} not found in shape ${shapeId}`);
    }

    // Get the surface from the face
    const surface = oc.BRep_Tool.Surface_2(targetFace);

    // Check if it's a planar surface
    const surfaceTypeName = surface.get().$$.ptrType.name;
    const isPlanar = surfaceTypeName === "Geom_Plane*";

    if (!isPlanar) {
      // Non-planar face - return error
      postMessage({
        type: "error",
        message: "Cannot create sketch on non-planar face. Please select a flat face.",
      });
      return;
    }

    // Extract plane geometry
    const plane = new oc.Handle_Geom_Plane_2(surface.get()).get();
    const planeLocation = plane.Location();
    const planeAxis = plane.Axis();
    const planeNormal = planeAxis.Direction();

    // Extract plane normal and OCC surface origin
    const nx = planeNormal.X();
    const ny = planeNormal.Y();
    const nz = planeNormal.Z();
    const px = planeLocation.X();
    const py = planeLocation.Y();
    const pz = planeLocation.Z();

    // Project global origin (0,0,0) onto the plane
    // This ensures sketch (0,0) aligns with project origin, matching default XY/XZ/YZ planes
    // Formula: t = dot(P - O, N) / dot(N, N), projected = O + t*N
    // Since O=(0,0,0) and N is unit vector, simplifies to: t = dot(P, N)
    const t = px * nx + py * ny + pz * nz;
    const origin: Point3D = {
      x: t * nx,
      y: t * ny,
      z: t * nz,
    };

    const normal: Vector3D = {
      x: nx,
      y: ny,
      z: nz,
    };

    // Send response
    postMessage({
      type: "faceGeometry",
      faceId,
      origin,
      normal,
      isPlanar: true,
    });

  } catch (err: any) {
    postMessage({
      type: "error",
      message: `Failed to get face geometry: ${err.message ?? err}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Build & mesh pipeline (legacy bottle demo)
// ---------------------------------------------------------------------------
function buildModel(params: { width: number; height: number; thickness: number }) {
  try {
    postMessage({ type: "progress", message: "Building model…" });

    const shape = buildBottle(params);

    postMessage({ type: "progress", message: "Tessellating…" });

    const mesh = tessellate(shape, 0.1, 0.5);

    // Transfer buffers for zero-copy performance
    const transferables = [
      mesh.faces.vertices.buffer,
      mesh.faces.indices.buffer,
      mesh.edges.vertices.buffer,
    ];

    postMessage({ type: "result", ...mesh }, transferables as any);
  } catch (err: any) {
    postMessage({ type: "error", error: `Build failed: ${err.message ?? err}` });
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
self.onmessage = async (e: MessageEvent) => {
  const message = e.data as WorkerRequest;

  try {
    // Check if OpenCascade is initialized (except for init message)
    if (message.type !== "init" && !oc) {
      postMessage({ type: "error", message: "OpenCascade not initialized" });
      return;
    }

    switch (message.type) {
      case "init":
        await init();
        break;

      case "buildSketch":
        handleBuildSketch(message.sketchId, message.plane, message.elements);
        break;

      case "extrudeSketch":
        handleExtrudeSketch(message.featureId, message.sketchId, message.params);
        break;

      case "revolveSketch":
        handleRevolveSketch(message.featureId, message.sketchId, message.params);
        break;

      case "deleteShape":
        shapeStorage.delete(message.shapeId);
        break;

      case "rebuild":
        handleRebuild(message.project);
        break;

      case "getFaceGeometry":
        handleGetFaceGeometry(message.faceId, message.shapeId);
        break;

      // Legacy bottle demo support
      case "build" as any:
        buildModel((message as any).params);
        break;

      default:
        postMessage({
          type: "error",
          message: `Unknown message type: ${(message as any).type}`,
        });
    }
  } catch (err: any) {
    postMessage({
      type: "error",
      message: err.message ?? String(err),
    });
  }
};

// Auto-init on worker creation
init();
