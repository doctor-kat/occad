import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getPlaneTransform, getWorkplaneTransform } from '@/frontend/viewport/sketch/getPlaneTransform';
import { PlaneType } from '@/cad/types';
import type { SketchPlane, Workplane } from '@/cad/types';

/**
 * Pure sketch-placement math: maps a sketch plane to the world transform used to
 * lay out the sketch overlay. A regression here silently mis-places/mis-orients
 * sketches (the same failure class as the extrude-direction bug), so the basis
 * vectors + origin are pinned per plane type.
 */

function basisOf(m: THREE.Matrix4) {
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  m.extractBasis(x, y, z);
  const pos = new THREE.Vector3().setFromMatrixPosition(m);
  return { x, y, z, pos };
}

const expectVec = (v: THREE.Vector3, [x, y, z]: [number, number, number]) => {
  expect(v.x).toBeCloseTo(x);
  expect(v.y).toBeCloseTo(y);
  expect(v.z).toBeCloseTo(z);
};

describe('getPlaneTransform', () => {
  it('XY plane is the identity basis, offset shifts along +Z', () => {
    const { x, y, z, pos } = basisOf(getPlaneTransform({ type: PlaneType.XY } as SketchPlane));
    expectVec(x, [1, 0, 0]);
    expectVec(y, [0, 1, 0]);
    expectVec(z, [0, 0, 1]);
    expectVec(pos, [0, 0, 0]);

    const off = basisOf(getPlaneTransform({ type: PlaneType.XY, offset: 5 } as SketchPlane));
    expectVec(off.pos, [0, 0, 5]);
  });

  it('XZ (Top) plane: local Y→world −Z, normal→world +Y, offset shifts along +Y', () => {
    const { x, y, z, pos } = basisOf(getPlaneTransform({ type: PlaneType.XZ } as SketchPlane));
    expectVec(x, [1, 0, 0]); // local X → world X
    expectVec(y, [0, 0, -1]); // local Y → world −Z
    expectVec(z, [0, 1, 0]); // normal → world +Y
    expectVec(pos, [0, 0, 0]);

    const off = basisOf(getPlaneTransform({ type: PlaneType.XZ, offset: 7 } as SketchPlane));
    expectVec(off.pos, [0, 7, 0]);
  });

  it('YZ (Right) plane: local X→world Y, local Y→world Z, normal→world X, offset shifts along +X', () => {
    const { x, y, z, pos } = basisOf(getPlaneTransform({ type: PlaneType.YZ } as SketchPlane));
    expectVec(x, [0, 1, 0]);
    expectVec(y, [0, 0, 1]);
    expectVec(z, [1, 0, 0]);
    expectVec(pos, [0, 0, 0]);

    const off = basisOf(getPlaneTransform({ type: PlaneType.YZ, offset: 4 } as SketchPlane));
    expectVec(off.pos, [4, 0, 0]);
  });

  it('CUSTOM plane builds an orthonormal basis with the given normal and origin', () => {
    const plane = {
      type: PlaneType.CUSTOM,
      origin: { x: 1, y: 2, z: 3 },
      normal: { x: 0, y: 0, z: 2 }, // non-unit → should be normalized
    } as SketchPlane;
    const { x, y, z, pos } = basisOf(getPlaneTransform(plane));

    expectVec(z, [0, 0, 1]); // normalized normal
    expectVec(pos, [1, 2, 3]);
    // Orthonormal: unit length, mutually perpendicular.
    expect(x.length()).toBeCloseTo(1);
    expect(y.length()).toBeCloseTo(1);
    expect(x.dot(y)).toBeCloseTo(0);
    expect(x.dot(z)).toBeCloseTo(0);
    expect(y.dot(z)).toBeCloseTo(0);
  });

  it('CUSTOM plane handles a normal aligned with world X (the |n.x|>=0.9 branch)', () => {
    const plane = {
      type: PlaneType.CUSTOM,
      origin: { x: 0, y: 0, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
    } as SketchPlane;
    const { x, y, z } = basisOf(getPlaneTransform(plane));
    expectVec(z, [1, 0, 0]);
    expect(x.length()).toBeCloseTo(1);
    expect(y.length()).toBeCloseTo(1);
    expect(x.dot(z)).toBeCloseTo(0);
    expect(y.dot(z)).toBeCloseTo(0);
  });

  it('falls back to identity for incomplete CUSTOM data and for FACE planes', () => {
    const custom = basisOf(getPlaneTransform({ type: PlaneType.CUSTOM } as SketchPlane));
    expectVec(custom.z, [0, 0, 1]);
    expectVec(custom.pos, [0, 0, 0]);

    const face = basisOf(getPlaneTransform({ type: PlaneType.FACE } as SketchPlane));
    expectVec(face.x, [1, 0, 0]);
    expectVec(face.z, [0, 0, 1]);
  });
});

describe('getWorkplaneTransform', () => {
  it('places the basis vectors as columns and the origin as the translation', () => {
    const workplane: Workplane = {
      origin: { x: 10, y: 20, z: 30 },
      normal: { x: 0, y: 0, z: 1 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
    };
    const { x, y, z, pos } = basisOf(getWorkplaneTransform(workplane));
    expectVec(x, [1, 0, 0]);
    expectVec(y, [0, 1, 0]);
    expectVec(z, [0, 0, 1]);
    expectVec(pos, [10, 20, 30]);
  });

  it('maps a local sketch point through origin + x*X + y*Y', () => {
    // Right-plane-like workplane: local X→world Y, local Y→world Z.
    const workplane: Workplane = {
      origin: { x: 5, y: 0, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
      xAxis: { x: 0, y: 1, z: 0 },
      yAxis: { x: 0, y: 0, z: 1 },
    };
    const world = new THREE.Vector3(2, 3, 0).applyMatrix4(getWorkplaneTransform(workplane));
    // origin (5,0,0) + 2*(0,1,0) + 3*(0,0,1) = (5, 2, 3)
    expectVec(world, [5, 2, 3]);
  });
});
