/** Delete a shape from worker storage */
export interface DeleteShapeRequest {
    type: 'deleteShape';
    shapeId: string;
}
