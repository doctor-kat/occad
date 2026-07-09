/**
 * Vector math helpers used by `measureBetween` for direction/angle math.
 * Not shared with `measureShape` (which only deals in volume/bounding-box
 * scalars) — kept here rather than inline since `measureBetween`'s
 * direction/angle logic is split across a few small functions.
 */

export type Vec3 = { x: number; y: number; z: number };

export function toVec(d: { X(): number; Y(): number; Z(): number }): Vec3 {
  return { x: d.X(), y: d.Y(), z: d.Z() };
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Acute angle (0–90°) between two unit directions. Sub-shape direction sign is
 * arbitrary (a face normal or edge tangent can point either way), so we fold to
 * the acute angle via |dot|. Returns undefined when (anti)parallel — the caller
 * only reports an angle for non-parallel selections.
 */
export function acuteAngleDeg(a: Vec3, b: Vec3): number | undefined {
  const dot = Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z));
  if (dot > 0.99995) return undefined; // parallel within ~0.5°
  return (Math.acos(dot) * 180) / Math.PI;
}
