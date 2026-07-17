/**
 * Measure hash — a compact, drift-detecting fingerprint of a solid.
 *
 * Built from the four measurement quantities that together survive rigid
 * re-tessellation yet still change when the *shape* changes:
 *
 *   1. volume            — overall size/mass
 *   2. bounding box       — axis-aligned extent
 *   3. centre of mass     — where the material sits (position-sensitive)
 *   4. matrix of inertia  — how the material is distributed (orientation-sensitive)
 *
 * Volume + bbox alone are symmetry-blind: a cube filleted on the wrong edge has
 * an identical volume, bbox, surface area, and triangle count. The centre of
 * mass and inertia tensor are not — removing material from a different location
 * shifts the centroid and re-shapes the tensor. Hashing all four gives a single
 * value a golden-sample test can assert against to catch geometric regressions.
 *
 * Pure and OCC-free (operates on the plain `MeasurementData` numbers), so it is
 * unit-testable without the WASM kernel. `measureShape` supplies the input.
 */

import type { MeasurementData } from '@/cad/types';

export interface MeasureHashOptions {
  /**
   * Significant figures each quantity is rounded to before hashing. Lower =
   * more tolerant of floating-point / kernel-version noise, higher = stricter.
   * Default 6 — tight enough to catch real drift, loose enough that a rebuild
   * of the identical part reproduces the same hash.
   */
  sigFigs?: number;
}

const DEFAULT_SIG_FIGS = 6;

/** Sentinel emitted for an absent optional quantity, so its lack still hashes. */
const MISSING = 'x';

/**
 * Canonical, order-fixed list of the numbers that feed the hash. Exposed
 * separately from {@link measureHash} so a failing test can diff the readable
 * quantities rather than two opaque digests.
 */
export function measureFingerprint(
  m: MeasurementData,
  opts: MeasureHashOptions = {},
): string[] {
  const sig = opts.sigFigs ?? DEFAULT_SIG_FIGS;
  const n = (v: number | undefined): string =>
    v === undefined || !Number.isFinite(v) ? MISSING : canonicalNumber(v, sig);

  const { boundingBox: bb, centreOfMass: com, inertia: i } = m;
  return [
    n(m.volume),
    n(bb.min.x), n(bb.min.y), n(bb.min.z),
    n(bb.max.x), n(bb.max.y), n(bb.max.z),
    n(bb.size.x), n(bb.size.y), n(bb.size.z),
    n(com?.x), n(com?.y), n(com?.z),
    n(i?.xx), n(i?.yy), n(i?.zz), n(i?.xy), n(i?.xz), n(i?.yz),
  ];
}

/**
 * A short, stable hex digest of the measurement. Identical geometry (rebuilt or
 * re-tessellated) yields an identical hash; a same-volume-but-wrong-shape
 * regression yields a different one. Not cryptographic — a fast content hash
 * for equality checks in tests.
 */
export function measureHash(
  m: MeasurementData,
  opts: MeasureHashOptions = {},
): string {
  return cyrb53(measureFingerprint(m, opts).join('|'));
}

/**
 * Round to `sig` significant figures and render as a canonical string, so
 * floating-point noise below the rounding threshold cannot perturb the hash.
 * `toExponential(sig - 1)` both rounds and normalises the representation —
 * `-0`, `0`, and `0.0` all collapse to the same `"0.…e+0"` form.
 */
function canonicalNumber(v: number, sig: number): string {
  return v.toExponential(Math.max(0, sig - 1));
}

/**
 * cyrb53 — a well-known fast 53-bit string hash (public domain). Deterministic
 * across platforms; returned as a zero-padded 14-char hex string.
 */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hi = h2 >>> 0;
  const lo = h1 >>> 0;
  return hi.toString(16).padStart(6, '0') + lo.toString(16).padStart(8, '0');
}
