import type { ImportFormat } from './ImportFormat';

/**
 * Parameters for an Import feature. The raw file text is stored inline so a
 * parametric rebuild can re-parse the geometry deterministically (the worker's
 * shape storage is cleared on every rebuild). STEP/IGES/OBJ are all text-based,
 * so `content` is the file's UTF-8 text.
 */
export interface ImportParams {
  format: ImportFormat;
  /** Original file name, used for the feature label and re-export defaults. */
  fileName: string;
  /** Full file contents as text. */
  content: string;
}
