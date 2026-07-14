/**
 * handleGetFaceGeometry — extract a picked face's plane and boundary edges.
 */

import type { WorkerContext } from '../workerContext';
import { post } from '../workerContext';
import { formatError } from './shared';

/**
 * Handle getFaceGeometry request
 */
export function handleGetFaceGeometry(ctx: WorkerContext, faceId: number, shapeId: string): void {
  const { oc } = ctx;
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error(`Shape ${shapeId} not found`);
    const faceMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, faceMap);
    if (faceId < 0 || faceId >= faceMap.Extent()) throw new Error(`Face ${faceId} not found`);
    const targetFace = oc.TopoDS.Face_1(faceMap.FindKey(faceId + 1));
    const surface = oc.BRep_Tool.Surface_2(targetFace);
    const plane = new oc.Handle_Geom_Plane_2(surface.get()).get();
    const nx = plane.Axis().Direction().X(), ny = plane.Axis().Direction().Y(), nz = plane.Axis().Direction().Z();
    const px = plane.Location().X(), py = plane.Location().Y(), pz = plane.Location().Z();
    const t = px * nx + py * ny + pz * nz;

    // Find boundary edges of this face
    const boundaryEdges: string[] = [];
    const edgeMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(targetFace, oc.TopAbs_ShapeEnum.TopAbs_EDGE, edgeMap);

    // We need to find the index of these edges in the global shape to match the tags
    const globalEdgeMap = new oc.TopTools_IndexedMapOfShape_1();
    oc.TopExp.MapShapes_1(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, globalEdgeMap);

    for (let i = 1; i <= edgeMap.Extent(); i++) {
      const edge = edgeMap.FindKey(i);
      const globalIdx = globalEdgeMap.FindIndex(edge);
      if (globalIdx > 0) {
        boundaryEdges.push(`edge-${globalIdx - 1}`);
      }
    }

    post({
      type: 'faceGeometry',
      faceId,
      origin: { x: t * nx, y: t * ny, z: t * nz },
      normal: { x: nx, y: ny, z: nz },
      isPlanar: true,
      boundaryEdges
    });

    edgeMap.delete();
    globalEdgeMap.delete();
    faceMap.delete();
  } catch (err: unknown) {
    // Scoped with a featureId (even a synthetic one keyed off the request) so a
    // single missed face-pick can't escalate into the app-wide fatal ErrorOverlay
    // that an unscoped error triggers (see useOpenCascade's `!msg.featureId` check).
    post({ type: 'error', message: `Failed to get face geometry: ${formatError(err)}`, featureId: `face-pick-${shapeId}` });
  }
}
