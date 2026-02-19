import type { Point3D, Vector3D } from '../../geometry';

/** Face geometry properties response */
export interface FaceGeometryResponse {
    type: 'faceGeometry';
    faceId: number;
    origin: Point3D;
    normal: Vector3D;
    isPlanar: boolean;
}
