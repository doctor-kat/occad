/** 2D Point (for sketch geometry) */
export interface Point2D {
  x: number;
  y: number;
  /** Optional: ID of the SketchPoint this Point2D might represent */
  id?: string;
}
