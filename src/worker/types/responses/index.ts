import type { ReadyResponse } from './ReadyResponse';
import type { SketchBuiltResponse } from './SketchBuiltResponse';
import type { FeatureBuiltResponse } from './FeatureBuiltResponse';
import type { RebuildCompleteResponse } from './RebuildCompleteResponse';
import type { RebuildProgressResponse } from './RebuildProgressResponse';
import type { FaceGeometryResponse } from './FaceGeometryResponse';
import type { ErrorResponse } from './ErrorResponse';
import type { ProgressResponse } from './ProgressResponse';
import type { SelectorResolvedResponse } from './SelectorResolvedResponse';
import type { ExportedResponse } from './ExportedResponse';
import type { MeasuredResponse } from './MeasuredResponse';
import type { MeasuredBetweenResponse } from './MeasuredBetweenResponse';

export type {
  ReadyResponse,
  SketchBuiltResponse,
  FeatureBuiltResponse,
  RebuildCompleteResponse,
  RebuildProgressResponse,
  FaceGeometryResponse,
  ErrorResponse,
  ProgressResponse,
  SelectorResolvedResponse,
  ExportedResponse,
  MeasuredResponse,
  MeasuredBetweenResponse,
};

// ============================================================================
// Worker Response Types
// ============================================================================

/** Messages sent from OpenCascade worker to main thread */
export type WorkerResponse =
  | ReadyResponse
  | SketchBuiltResponse
  | FeatureBuiltResponse
  | RebuildCompleteResponse
  | RebuildProgressResponse
  | FaceGeometryResponse
  | ErrorResponse
  | ProgressResponse
  | SelectorResolvedResponse
  | ExportedResponse
  | MeasuredResponse
  | MeasuredBetweenResponse;

