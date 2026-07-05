/** Solid-interchange formats the current body can be written out to. */
export type ExportFormat = 'step' | 'iges' | 'stl';

/** Default file extension for each export format. */
export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  step: 'step',
  iges: 'iges',
  stl: 'stl',
};
