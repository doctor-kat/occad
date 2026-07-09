import { TrackStatus } from './history';

type TopoDS_Shape = any;

/** Outcome of following one sub-shape forward through an operation. */
export interface FollowResult {
  status: TrackStatus;
  /** Descendant sub-shape(s) in the operation's output. Empty when removed. */
  shapes: TopoDS_Shape[];
}
