import type { ImportFormat, ExportFormat } from '@/cad/types';
import { ImportFormat as ImportFormatEnum, ExportFormat as ExportFormatEnum } from '@/cad/types';

// Sketch drawing tools. Selecting one of these enters sketch mode rather than
// opening the OperationPanel.
import { SketchOperation } from '@/cad/types';

export const SKETCH_TOOL_OPERATIONS: SketchOperation[] = [
  SketchOperation.LINE,
  SketchOperation.RECTANGLE,
  SketchOperation.CIRCLE,
  SketchOperation.POLYGON,
  SketchOperation.ARC,
  SketchOperation.CENTERPOINT_ARC,
  SketchOperation.TANGENT_ARC,
  SketchOperation.PERIMETER_CIRCLE,
  SketchOperation.ELLIPSE,
  SketchOperation.BEZIER,
];

// I/O operation ids are `<direction>-<format>` (e.g. 'export-stl', 'import-step'),
// so the direction and format are derived from the id itself rather than a parallel
// lookup table. Guard against the known format unions so non-I/O ops that also
// contain a dash ('extrude-boss', 'revolved-cut') and disabled formats fall through.
export const IMPORT_FORMATS: ImportFormat[] = [ImportFormatEnum.Step, ImportFormatEnum.Iges, ImportFormatEnum.Obj];
export const EXPORT_FORMATS: ExportFormat[] = [ExportFormatEnum.Step, ExportFormatEnum.Iges, ExportFormatEnum.Stl];

export type ParsedIoOperation =
  | { direction: 'import'; format: ImportFormat }
  | { direction: 'export'; format: ExportFormat }
  | null;

export function parseIoOperation(op: string): ParsedIoOperation {
  const dash = op.indexOf('-');
  if (dash < 0) return null;
  const direction = op.slice(0, dash);
  const format = op.slice(dash + 1);
  if (direction === 'import' && (IMPORT_FORMATS as string[]).includes(format)) {
    return { direction, format: format as ImportFormat };
  }
  if (direction === 'export' && (EXPORT_FORMATS as string[]).includes(format)) {
    return { direction, format: format as ExportFormat };
  }
  return null;
}
