/**
 * Per-face → owning-feature attribution for the rebuild body.
 *
 * The topological-naming problem again (see fingerprint.ts): the final body's
 * faces carry only ordinal ids, with no record of *which feature* introduced
 * each one. This module attributes every face of the running rebuild body to the
 * feature that first produced it, by carrying an owner alongside the body and
 * updating it geometrically at each feature step:
 *
 *   - Fingerprint the body's faces after a feature runs.
 *   - Any new face that confidently matches a face from *before* the step
 *     inherits that face's existing owner (it survived the operation unchanged).
 *   - Any face with no confident match is *new* — the feature that just ran owns
 *     it (e.g. the side/end faces a fresh extrude or primitive adds, or the
 *     rounded faces a fillet creates).
 *
 * This is heuristic — a boolean/fillet that reshapes an existing face enough to
 * change its fingerprint re-attributes it to the reshaping feature — but it is
 * correct for the common cases (each primitive/extrude owns its own faces, and a
 * modification owns the faces it creates) and degrades gracefully (an
 * unattributable face is simply left owner-less, and the menu falls back to the
 * selected/tip feature).
 *
 * The face ordering here (fingerprintAll → TopExp face map order) is the same
 * ordering `tessellate` uses for `faceMapping`, so the returned owners array is
 * indexed by the same CAD face id the mesh reports on pick.
 */

import type { Fingerprint } from '@/cad/types';
import { matchFingerprint } from './fingerprint';

export interface FaceOwnership {
  /** Fingerprints of the current body's faces, in CAD-face-id order. */
  fps: Fingerprint[];
  /** Owner feature id per face (null when unattributed), same order as `fps`. */
  owners: (string | null)[];
}

export const EMPTY_OWNERSHIP: FaceOwnership = { fps: [], owners: [] };

/**
 * Roll the face ownership forward across one feature step. `newFps` are the
 * fingerprints of the body's faces *after* `featureId` ran; `prev` is the
 * ownership state from before it. Faces matching a previous face keep their
 * owner; unmatched (new) faces are owned by `featureId`.
 */
export function attributeFaceOwners(
  prev: FaceOwnership,
  newFps: Fingerprint[],
  featureId: string,
): FaceOwnership {
  const owners = newFps.map((fp) => {
    const m = matchFingerprint(fp, prev.fps);
    return m.confident ? prev.owners[m.index] : featureId;
  });
  return { fps: newFps, owners };
}
