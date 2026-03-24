import type { Point3D, Vector3D } from '@/cad/types';

/** Face geometry properties response */
export interface FaceGeometryResponse {
    type: 'faceGeometry';
    faceId: number;
    origin: Point3D;
    normal: Vector3D;
    isPlanar: boolean;
    boundaryEdges?: string[]; // Array of edge tags like "edge-1", "edge-2"
}
