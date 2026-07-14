import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeSketchViewpoint } from './sketchViewpoint';
import type { Workplane } from '@/cad/types';

const xyPlane: Workplane = {
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
};

describe('computeSketchViewpoint', () => {
  it('places the camera on the plane normal, looking at the origin', () => {
    const cam = new THREE.Vector3(1000, 800, 1000); // default iso camera
    const { position, target, up } = computeSketchViewpoint(xyPlane, cam);

    expect(target.toArray()).toEqual([0, 0, 0]);
    expect(up.toArray()).toEqual([0, 1, 0]);
    // For the XY plane the camera ends up straight along +Z (x=y=0).
    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(0);
    expect(position.z).toBeGreaterThan(0);
  });

  it('preserves the current distance to the plane (only changes the angle)', () => {
    const cam = new THREE.Vector3(1000, 800, 1000);
    const { position, target } = computeSketchViewpoint(xyPlane, cam);
    expect(position.distanceTo(target)).toBeCloseTo(cam.distanceTo(target));
  });

  it('keeps the camera on the side it is already on (no flip to the back)', () => {
    const front = computeSketchViewpoint(xyPlane, new THREE.Vector3(0, 0, 500));
    expect(front.position.z).toBeGreaterThan(0);

    const back = computeSketchViewpoint(xyPlane, new THREE.Vector3(0, 0, -500));
    expect(back.position.z).toBeLessThan(0);
  });

  it('falls back to a default distance when the camera sits on the origin', () => {
    const { position, target } = computeSketchViewpoint(xyPlane, new THREE.Vector3(0, 0, 0), 1500);
    expect(position.distanceTo(target)).toBeCloseTo(1500);
  });

  it('orients to an angled custom plane along its normal', () => {
    const n = new THREE.Vector3(1, 1, 0).normalize();
    const plane: Workplane = {
      origin: { x: 10, y: 0, z: 0 },
      normal: { x: n.x, y: n.y, z: n.z },
      xAxis: { x: 0, y: 0, z: 1 },
      yAxis: { x: -n.y, y: n.x, z: 0 },
    };
    const { position, target } = computeSketchViewpoint(plane, new THREE.Vector3(1000, 1000, 0));
    const dir = new THREE.Vector3().subVectors(position, target).normalize();
    // Camera sits along the plane normal from the origin.
    expect(Math.abs(dir.dot(n))).toBeCloseTo(1);
  });
});
