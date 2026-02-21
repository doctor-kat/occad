export enum MeasureType {
  DISTANCE = 'distance',
  ANGLE = 'angle',
  AREA = 'area',
  VOLUME = 'volume',
}

export interface MeasureParams {
  type: MeasureType;
  /** Entity IDs to measure (faces, edges, vertices) */
  entities: string[];
}
