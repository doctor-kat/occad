import { describe, it, expect } from 'vitest';
import { measureHash, measureFingerprint } from '@/cad/solid/analysis/measureHash';
import type { MeasurementData } from '@/cad/types';

/** A 20mm cube sitting at the origin: baseline for the equality/drift cases. */
function cubeMeasurement(): MeasurementData {
  return {
    volume: 8000,
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 20, y: 20, z: 20 },
      size: { x: 20, y: 20, z: 20 },
    },
    centreOfMass: { x: 10, y: 10, z: 10 },
    inertia: { xx: 1_066_667, yy: 1_066_667, zz: 1_066_667, xy: -800_000, xz: -800_000, yz: -800_000 },
  };
}

describe('measureHash', () => {
  it('is deterministic — identical measurements hash identically', () => {
    expect(measureHash(cubeMeasurement())).toBe(measureHash(cubeMeasurement()));
  });

  it('is stable under floating-point noise below the rounding threshold', () => {
    const base = cubeMeasurement();
    const jittered = cubeMeasurement();
    // Perturb well below 6 significant figures.
    jittered.volume += 8000 * 1e-9;
    jittered.centreOfMass!.x += 1e-8;
    jittered.inertia!.xx += 1e-3;
    expect(measureHash(jittered)).toBe(measureHash(base));
  });

  it('changes when volume changes', () => {
    const bigger = cubeMeasurement();
    bigger.volume *= 1.01;
    expect(measureHash(bigger)).not.toBe(measureHash(cubeMeasurement()));
  });

  it('detects a same-volume, same-bbox regression via mass distribution', () => {
    // The whole point: a fillet on the wrong edge keeps volume + bbox but moves
    // the centre of mass and reshapes the inertia tensor. Only those two fields
    // differ here — the hash must still change.
    const wrongEdge = cubeMeasurement();
    wrongEdge.centreOfMass = { x: 10.2, y: 10, z: 9.8 };
    wrongEdge.inertia = { ...wrongEdge.inertia!, xy: -790_000 };
    expect(wrongEdge.volume).toBe(cubeMeasurement().volume);
    expect(wrongEdge.boundingBox.size).toEqual(cubeMeasurement().boundingBox.size);
    expect(measureHash(wrongEdge)).not.toBe(measureHash(cubeMeasurement()));
  });

  it('folds -0 and +0 to the same hash', () => {
    const a = cubeMeasurement();
    const b = cubeMeasurement();
    a.centreOfMass!.x = 0;
    b.centreOfMass!.x = -0;
    expect(measureHash(a)).toBe(measureHash(b));
  });

  it('distinguishes present vs. absent mass-distribution data', () => {
    const full = cubeMeasurement();
    const legacy: MeasurementData = { volume: full.volume, boundingBox: full.boundingBox };
    expect(measureHash(legacy)).not.toBe(measureHash(full));
  });

  it('sigFigs tunes tolerance', () => {
    const base = cubeMeasurement();
    const drifted = cubeMeasurement();
    drifted.volume += 8000 * 1e-4; // 0.01% change
    // Strict: caught. Loose: folded away.
    expect(measureHash(drifted, { sigFigs: 8 })).not.toBe(measureHash(base, { sigFigs: 8 }));
    expect(measureHash(drifted, { sigFigs: 3 })).toBe(measureHash(base, { sigFigs: 3 }));
  });

  it('fingerprint is a readable, fixed-length list for diffing', () => {
    const fp = measureFingerprint(cubeMeasurement());
    expect(fp).toHaveLength(19); // volume + bbox(9) + com(3) + inertia(6)
    expect(fp.every((s) => typeof s === 'string')).toBe(true);
  });
});
