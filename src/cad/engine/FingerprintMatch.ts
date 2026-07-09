export interface FingerprintMatch {
  /** Index of the best candidate, or -1 if none. */
  index: number;
  /** Score of the best candidate (Infinity if no kind/type-compatible candidate). */
  score: number;
  /** True when the best candidate is within threshold AND unambiguous. */
  confident: boolean;
  /** True when two candidates are both plausible and too close to tell apart. */
  ambiguous: boolean;
}
