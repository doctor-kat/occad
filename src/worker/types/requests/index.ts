import type { InitRequest } from './InitRequest';
import type { BuildSketchRequest } from './BuildSketchRequest';
import type { ExtrudeSketchRequest } from './ExtrudeSketchRequest';
import type { RevolveSketchRequest } from './RevolveSketchRequest';
import type { CreatePrimitiveRequest } from './CreatePrimitiveRequest';
import type { BooleanOperationRequest } from './BooleanOperationRequest';
import type { RebuildRequest } from './RebuildRequest';
import type { DeleteShapeRequest } from './DeleteShapeRequest';
import type { GetFaceGeometryRequest } from './GetFaceGeometryRequest';

export type {
  InitRequest,
  BuildSketchRequest,
  ExtrudeSketchRequest,
  RevolveSketchRequest,
  CreatePrimitiveRequest,
  BooleanOperationRequest,
  RebuildRequest,
  DeleteShapeRequest,
  GetFaceGeometryRequest,
};

// ============================================================================
// Worker Request Types
// ============================================================================

/** Messages sent from main thread to OpenCascade worker */
export type WorkerRequest =
  | InitRequest
  | BuildSketchRequest
  | ExtrudeSketchRequest
  | RevolveSketchRequest
  | CreatePrimitiveRequest
  | BooleanOperationRequest
  | RebuildRequest
  | DeleteShapeRequest
  | GetFaceGeometryRequest;

