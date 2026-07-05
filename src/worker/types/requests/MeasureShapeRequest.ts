/** Compute volume + bounding box of a stored shape (ROADMAP §4). */
export interface MeasureShapeRequest {
  type: 'measureShape';
  requestId: string;
  shapeId: string;
}
