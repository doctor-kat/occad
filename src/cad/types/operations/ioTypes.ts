/** Solid-interchange formats that can be read back into a B-rep body. */
export enum ImportFormat {
  Step = 'step',
  Iges = 'iges',
  Obj = 'obj',
}

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

/** Solid-interchange formats the current body can be written out to. */
export enum ExportFormat {
  Step = 'step',
  Iges = 'iges',
  Stl = 'stl',
}

/** Default file extension for each export format. */
export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  [ExportFormat.Step]: 'step',
  [ExportFormat.Iges]: 'iges',
  [ExportFormat.Stl]: 'stl',
};

export enum IOOperation {
  IMPORT_STEP = 'import-step',
  IMPORT_IGES = 'import-iges',
  IMPORT_OBJ = 'import-obj',
  EXPORT_STEP = 'export-step',
  EXPORT_IGES = 'export-iges',
  EXPORT_STL = 'export-stl',
  EXPORT_GLTF = 'export-gltf'
}
