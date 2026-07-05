import type { ExportFormat } from '@/cad/types';

/** Result of an exportShape request: the serialized file text. */
export interface ExportedResponse {
  type: 'exported';
  requestId: string;
  format: ExportFormat;
  /** Serialized file contents (STEP/IGES/STL are all text). */
  content: string;
}
