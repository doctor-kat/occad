/**
 * Tessellation Functions
 *
 * Convert OpenCascade shapes to triangle meshes and edge polylines.
 */

type TopoDS_Shape = any;
import type { MeshData } from '@/types/cad';
import type { WorkerContext } from './workerContext';

/**
 * Tessellate a TopoDS_Shape and extract mesh buffers
 * @param ctx Worker context
 * @param shape Shape to tessellate
 * @param linearDeflection Linear deflection tolerance
 * @param angularDeflection Angular deflection tolerance (radians)
 * @returns Mesh data with vertices, normals, indices, and edge data
 */
export function tessellate(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  linearDeflection = 0.1,
  angularDeflection = 0.5
): MeshData {
  const { oc } = ctx;

  // Perform incremental meshing
  const mesher = new oc.BRepMesh_IncrementalMesh_2(shape, linearDeflection, false, angularDeflection, false);
  const meshDone = mesher.IsDone();
  console.log(`[OC Worker] Incremental Mesh done: ${meshDone}`);

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
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  let faceCount = 0;
  for (; faceExplorer.More(); faceExplorer.Next()) {
    faceCount++;
    const face = oc.TopoDS.Face_1(faceExplorer.Current());
    const location = new oc.TopLoc_Location_1();
    const handleTriangulation = oc.BRep_Tool.Triangulation(face, location, 0);

    if (handleTriangulation.IsNull()) {
      location.delete();
      handleTriangulation.delete();
      continue;
    }

    const triangulation = handleTriangulation.get();
    const nNodes = triangulation.NbNodes();
    const nTriangles = triangulation.NbTriangles();
    console.log(`[OC Worker] Face ${faceCount}: Nodes=${nNodes}, Triangles=${nTriangles}`);
    const transform = location.Transformation();
    const isReversed = face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED;

    // Vertices (apply location transform)
    for (let i = 1; i <= nNodes; i++) {
      const pnt = triangulation.Node(i).Transformed(transform);
      faceVertices.push(pnt.X(), pnt.Y(), pnt.Z());
      pnt.delete();
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

      faceIndices.push(n1 - 1 + vertexOffset, n2 - 1 + vertexOffset, n3 - 1 + vertexOffset);

      // Map this triangle to the current CAD face
      faceMapping.push(cadFaceId);
    }

    vertexOffset += nNodes;
    cadFaceId++; // Increment for next CAD face

    // Clean up
    location.delete();
    handleTriangulation.delete();
    transform.delete();
  }
  faceExplorer.delete();

  // ---- Extract edge polylines ----
  // Use TopExp.MapShapes_1 to get unique edges (HashCode is unreliable for deduplication)
  const edgeMap = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, edgeMap);

  const edgeCount = edgeMap.Extent();
  const edgeMapping: number[] = [];
  console.log(`[OC Worker] Found ${edgeCount} unique edges for tessellation`);

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
        edgeMapping.push(i - 1); // 0-based topological edge ID
        p1.delete();
        p2.delete();
      }
      transform.delete();
    } else {
      // Fall back: discretize the edge curve directly
      try {
        const adaptorCurve = new oc.BRepAdaptor_Curve_2(edge);
        const tangDef = new oc.GCPnts_TangentialDeflection_2(
          adaptorCurve,
          angularDeflection,
          linearDeflection,
          2, // minimum points
          1e-9, // U tolerance
          1e-7 // angular tolerance
        );
        const n = tangDef.NbPoints();
        for (let j = 1; j < n; j++) {
          const p1 = tangDef.Value(j);
          const p2 = tangDef.Value(j + 1);
          edgeVertices.push(p1.X(), p1.Y(), p1.Z());
          edgeVertices.push(p2.X(), p2.Y(), p2.Z());
          edgeMapping.push(i - 1); // 0-based topological edge ID
          p1.delete();
          p2.delete();
        }
        adaptorCurve.delete();
        tangDef.delete();
      } catch {
        // Skip edges that can't be discretized
      }
    }
    location.delete();
    handlePoly.delete();
  }
  mesher.delete();
  edgeMap.delete();
  console.log(`[OC Worker] Mesh buffers prepared. Face vertices: ${faceVertices.length / 3}, Edge vertices: ${edgeVertices.length / 3}`);

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
    const len = Math.sqrt(faceNormals[i] ** 2 + faceNormals[i + 1] ** 2 + faceNormals[i + 2] ** 2);
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

  if (faceVertices.length === 0 && edgeVertices.length === 0) {
    console.warn(`[OC Worker] Tessellation produced zero geometry for shape! FaceCount: ${faceCount}, EdgeCount: ${edgeCount}`);
  }

  return {
    faceVertices: new Float32Array(faceVertices),
    faceNormals: new Float32Array(faceNormals),
    faceIndices: new Uint32Array(faceIndices),
    edgeVertices: new Float32Array(edgeVertices),
    edgeIndices: new Uint32Array(edgeIndices),
    faceMapping: new Uint32Array(faceMapping),
    edgeMapping: new Uint32Array(edgeMapping),
    edgeCount,
  };
}

/**
 * Extract edge vertices from a shape for wireframe rendering
 * @param ctx Worker context
 * @param shape Shape to extract edges from
 * @param linearDeflection Linear deflection tolerance
 * @param angularDeflection Angular deflection tolerance (radians)
 * @returns Edge vertices as Float32Array
 */
export function extractEdgeVertices(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  linearDeflection = 0.1,
  angularDeflection = 0.5
): Float32Array {
  const { oc } = ctx;

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
      for (let j = 1; j < nbNodes; j++) {
        const p1 = poly.Nodes().Value(j).Transformed(transform);
        const p2 = poly.Nodes().Value(j + 1).Transformed(transform);
        edgeVertices.push(p1.X(), p1.Y(), p1.Z());
        edgeVertices.push(p2.X(), p2.Y(), p2.Z());
      }
    } else {
      try {
        const adaptorCurve = new oc.BRepAdaptor_Curve_2(edge);
        const tangDef = new oc.GCPnts_TangentialDeflection_2(
          adaptorCurve,
          angularDeflection,
          linearDeflection,
          2,
          1e-9,
          1e-7
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

  return new Float32Array(edgeVertices);
}
