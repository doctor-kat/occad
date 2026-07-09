/**
 * Import / Export engine (ROADMAP §3, §9.2)
 *
 * Reads and writes standard interchange formats using the OCCT translators that
 * ship in `opencascade.full.wasm` — no external dependency. All I/O funnels
 * through the Emscripten in-memory filesystem (`oc.FS`): OCCT readers/writers
 * only speak file paths, so we stage bytes on a scratch path, run the
 * translator, then read the result back out.
 */

type TopoDS_Shape = any;
import type { WorkerContext } from './workerContext';
import { ExportFormat, ImportFormat } from '@/cad/types';

/** Scratch directory inside the Emscripten FS used for all transfers. */
const SCRATCH_DIR = '/io';

/** The Emscripten in-memory filesystem (untyped in opencascade.js). */
function fs(ctx: WorkerContext): any {
  return (ctx.oc as any).FS;
}

/** File name (no directory) OCCT translators read/write for a given format. */
function scratchPath(ext: string): string {
  return `${SCRATCH_DIR}/model.${ext}`;
}

/** Ensure the scratch directory exists (idempotent). */
function ensureScratchDir(ctx: WorkerContext): void {
  try {
    fs(ctx).mkdir(SCRATCH_DIR);
  } catch {
    // EEXIST — already created on a previous call.
  }
}

/** Remove a scratch file, ignoring "not found". */
function removeScratch(ctx: WorkerContext, path: string): void {
  try {
    fs(ctx).unlink(path);
  } catch {
    /* nothing to clean up */
  }
}

/** True when the writer's `IFSelect_ReturnStatus` is `IFSelect_RetDone`. */
function isRetDone(ctx: WorkerContext, status: unknown): boolean {
  return status === ctx.oc.IFSelect_ReturnStatus.IFSelect_RetDone;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Serialize a shape to a standard format and return the file text.
 * STEP/IGES are BRep translators; STL tessellates first (meshing the shape in
 * place) since it is a mesh format.
 */
export function exportShapeToString(
  ctx: WorkerContext,
  shape: TopoDS_Shape,
  format: ExportFormat
): string {
  ensureScratchDir(ctx);

  switch (format) {
    case ExportFormat.Step:
      return writeStep(ctx, shape);
    case ExportFormat.Iges:
      return writeIges(ctx, shape);
    case ExportFormat.Stl:
      return writeStl(ctx, shape);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

function writeStep(ctx: WorkerContext, shape: TopoDS_Shape): string {
  const { oc } = ctx;
  const path = scratchPath('step');
  const writer = new oc.STEPControl_Writer_1();
  const progress = new oc.Message_ProgressRange_1();
  try {
    const transferStatus = writer.Transfer(
      shape,
      oc.STEPControl_StepModelType.STEPControl_AsIs,
      true,
      progress
    );
    if (!isRetDone(ctx, transferStatus)) throw new Error('STEP transfer failed');
    const writeStatus = writer.Write(path);
    if (!isRetDone(ctx, writeStatus)) throw new Error('STEP write failed');
    return readScratchText(ctx, path);
  } finally {
    progress.delete();
    writer.delete();
    removeScratch(ctx, path);
  }
}

function writeIges(ctx: WorkerContext, shape: TopoDS_Shape): string {
  const { oc } = ctx;
  const path = scratchPath('iges');
  const writer = new oc.IGESControl_Writer_1();
  const progress = new oc.Message_ProgressRange_1();
  try {
    if (!writer.AddShape(shape, progress)) throw new Error('IGES AddShape failed');
    writer.ComputeModel();
    if (!writer.Write_2(path, false)) throw new Error('IGES write failed');
    return readScratchText(ctx, path);
  } finally {
    progress.delete();
    writer.delete();
    removeScratch(ctx, path);
  }
}

function writeStl(ctx: WorkerContext, shape: TopoDS_Shape): string {
  const { oc } = ctx;
  const path = scratchPath('stl');
  // STL is a mesh format: the shape must be tessellated first, or the writer
  // emits an empty file. Mesh in place (mutates the shape's triangulation).
  const progress = new oc.Message_ProgressRange_1();
  const mesher = new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false);
  const writer = new oc.StlAPI_Writer();
  try {
    mesher.Perform(progress);
    if (!writer.Write(shape, path, progress)) throw new Error('STL write failed');
    return readScratchText(ctx, path);
  } finally {
    progress.delete();
    writer.delete();
    mesher.delete();
    removeScratch(ctx, path);
  }
}

/** Read a scratch file back as UTF-8 text. */
function readScratchText(ctx: WorkerContext, path: string): string {
  return fs(ctx).readFile(path, { encoding: 'utf8' }) as string;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Parse a file's text into a single TopoDS_Shape. STEP/IGES yield real B-rep
 * solids; OBJ yields a tessellated mesh shape (triangulated faces — usable for
 * display but not boolean-friendly).
 */
export function importShapeFromString(
  ctx: WorkerContext,
  format: ImportFormat,
  content: string
): TopoDS_Shape {
  ensureScratchDir(ctx);
  switch (format) {
    case ImportFormat.Step:
      return readViaXSControl(ctx, 'step', content, () => new ctx.oc.STEPControl_Reader_1());
    case ImportFormat.Iges:
      return readViaXSControl(ctx, 'iges', content, () => new ctx.oc.IGESControl_Reader_1());
    case ImportFormat.Obj:
      return readObj(ctx, content);
    default:
      throw new Error(`Unsupported import format: ${format}`);
  }
}

/** Write text to a scratch file so an OCCT reader can open it by path. */
function writeScratchText(ctx: WorkerContext, path: string, content: string): void {
  fs(ctx).writeFile(path, content);
}

/**
 * Shared STEP/IGES import path — both readers extend `XSControl_Reader`, so the
 * ReadFile → TransferRoots → OneShape sequence is identical.
 */
function readViaXSControl(
  ctx: WorkerContext,
  ext: string,
  content: string,
  makeReader: () => any
): TopoDS_Shape {
  const { oc } = ctx;
  const path = scratchPath(ext);
  writeScratchText(ctx, path, content);
  const reader = makeReader();
  const progress = new oc.Message_ProgressRange_1();
  try {
    const status = reader.ReadFile(path);
    if (!isRetDone(ctx, status)) throw new Error(`Failed to read ${ext.toUpperCase()} file`);
    reader.TransferRoots(progress);
    if (reader.NbShapes() < 1) throw new Error(`${ext.toUpperCase()} file contained no shapes`);
    return reader.OneShape();
  } finally {
    progress.delete();
    reader.delete();
    removeScratch(ctx, path);
  }
}

/**
 * OBJ import via `RWObj_CafReader`. OBJ is mesh-based and XCAF-oriented, so we
 * stage it into a throwaway document and pull the merged single shape back out.
 */
function readObj(ctx: WorkerContext, content: string): TopoDS_Shape {
  const { oc } = ctx;
  const path = scratchPath('obj');
  writeScratchText(ctx, path, content);
  // The XCAF mesh readers take OCCT string types, not JS strings — RWMesh's
  // `Perform` wants a TCollection_AsciiString or embind throws a BindingError.
  const format = new oc.TCollection_ExtendedString_2('BinXCAF', true);
  const doc = new oc.TDocStd_Document(format);
  const reader = new oc.RWObj_CafReader();
  const progress = new oc.Message_ProgressRange_1();
  const filePath = new oc.TCollection_AsciiString_2(path);
  try {
    reader.SetDocument(new oc.Handle_TDocStd_Document_2(doc));
    if (!reader.Perform(filePath, progress)) throw new Error('Failed to read OBJ file');
    const shape = reader.SingleShape();
    if (!shape || shape.IsNull()) throw new Error('OBJ file contained no mesh');
    return shape;
  } finally {
    filePath.delete();
    progress.delete();
    reader.delete();
    doc.delete();
    format.delete();
    removeScratch(ctx, path);
  }
}
