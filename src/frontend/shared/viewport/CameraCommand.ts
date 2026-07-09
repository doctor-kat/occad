import type { CameraViewType } from '../viewportStore';

/** A one-shot camera framing request; `nonce` makes each request distinct so the
 *  in-Canvas CameraController re-runs even when the same view is picked twice. */
export interface CameraCommand {
  view: CameraViewType;
  nonce: number;
}
