import type { ExportFormat } from '@/cad/types';

/** Serialize a stored shape to a standard interchange format (ROADMAP §3). */
export interface ExportShapeRequest {
  type: 'exportShape';
  requestId: string;
  shapeId: string;
  format: ExportFormat;
}
