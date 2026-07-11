/**
 * Request/response correlation registry for the worker bridge.
 *
 * The individual DTOs in requests/ and responses/ remain the source of truth
 * for each message's shape. This file only adds the mapping from a
 * `requestId`-carrying request type to the response type it resolves to, so
 * `useOpenCascade`'s generic `call()` can be typed without a bespoke
 * useCallback + option-callback + onmessage-case per operation (see
 * Architecture review candidate #1).
 *
 * Only requests that carry a `requestId` and resolve to exactly one response
 * belong here — buildSketch/extrudeSketch/revolveSketch/rebuild fan out into
 * multiple state updates and stay event-style in useOpenCascade.
 */
import type {
  ResolveSelectorRequest,
  ExportShapeRequest,
  MeasureShapeRequest,
  MeasureBetweenRequest,
  GetEdgeLoopRequest,
} from './requests';
import type {
  SelectorResolvedResponse,
  ExportedResponse,
  MeasuredResponse,
  MeasuredBetweenResponse,
  EdgeLoopResponse,
} from './responses';

/** Maps each correlated request type to the payload passed to `call()` and the response it resolves to. */
export interface CorrelatedCallMap {
  resolveSelector: {
    request: Omit<ResolveSelectorRequest, 'type' | 'requestId'>;
    response: SelectorResolvedResponse;
  };
  exportShape: {
    request: Omit<ExportShapeRequest, 'type' | 'requestId'>;
    response: ExportedResponse;
  };
  measureShape: {
    request: Omit<MeasureShapeRequest, 'type' | 'requestId'>;
    response: MeasuredResponse;
  };
  measureBetween: {
    request: Omit<MeasureBetweenRequest, 'type' | 'requestId'>;
    response: MeasuredBetweenResponse;
  };
  getEdgeLoop: {
    request: Omit<GetEdgeLoopRequest, 'type' | 'requestId'>;
    response: EdgeLoopResponse;
  };
}

export type CorrelatedCallType = keyof CorrelatedCallMap;

/** The set of response `type` strings that are correlated by `requestId` and handled by `call()`. */
export const CORRELATED_RESPONSE_TYPES = new Set<string>([
  'selectorResolved',
  'exported',
  'measured',
  'measuredBetween',
  'edgeLoop',
]);
