/**
 * handleExportShape — serialize a stored body to an interchange format.
 */

import type { ExportFormat } from '@/cad/types';
import type { WorkerContext } from '../workerContext';
import { post } from '../workerContext';
import { exportShapeToString } from '../io';
import { formatError } from './shared';

/**
 * Handle exportShape request (ROADMAP §3): serialize a stored body to a
 * standard interchange format and post the file text back to the main thread,
 * which triggers the browser download.
 */
export function handleExportShape(
  ctx: WorkerContext,
  requestId: string,
  shapeId: string,
  format: ExportFormat
): void {
  try {
    const shape = ctx.shapeStorage.get(shapeId);
    if (!shape) throw new Error('No geometry to export — build a feature first');
    const content = exportShapeToString(ctx, shape, format);
    post({ type: 'exported', requestId, format, content });
  } catch (err: unknown) {
    post({ type: 'error', message: `Failed to export ${format.toUpperCase()}: ${formatError(err)}`, featureId: `export-${requestId}` });
  }
}
