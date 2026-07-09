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
