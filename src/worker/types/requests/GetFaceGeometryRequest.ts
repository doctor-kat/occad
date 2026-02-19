/** Get geometric properties of a face (origin, normal) */
export interface GetFaceGeometryRequest {
    type: 'getFaceGeometry';
    faceId: number;
    shapeId: string;
}
