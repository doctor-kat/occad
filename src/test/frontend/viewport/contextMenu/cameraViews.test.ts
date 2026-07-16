import { describe, it, expect } from 'vitest';
import { boundsFromVertices, computeCameraView } from '@/frontend/viewport/contextMenu/cameraViews';
import { CameraViewType } from '@/frontend/shared/viewportStore';

describe('boundsFromVertices', () => {
  it('returns null for an empty buffer', () => {
    expect(boundsFromVertices(new Float32Array([]))).toBeNull();
  });

  it('computes center and a positive radius for a unit cube', () => {
    // 8 corners of a cube spanning [-1,1] on each axis.
    const verts: number[] = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) verts.push(x, y, z);
    const b = boundsFromVertices(new Float32Array(verts))!;
    expect(b.center).toEqual({ x: 0, y: 0, z: 0 });
    expect(b.min).toEqual({ x: -1, y: -1, z: -1 });
    expect(b.max).toEqual({ x: 1, y: 1, z: 1 });
    expect(b.radius).toBeCloseTo(Math.sqrt(3));
  });

  it('handles an offset box (center not at origin)', () => {
    const b = boundsFromVertices(new Float32Array([10, 10, 10, 20, 30, 40]))!;
    expect(b.center).toEqual({ x: 15, y: 20, z: 25 });
  });
});

describe('computeCameraView', () => {
  const bounds = { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 }, center: { x: 0, y: 0, z: 0 }, radius: 1 };

  it('places a front view on +Z looking at the center', () => {
    const { position, target } = computeCameraView(CameraViewType.Front, bounds, { x: 5, y: 5, z: 5 });
    expect(target).toEqual({ x: 0, y: 0, z: 0 });
    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(0);
    expect(position.z).toBeGreaterThan(0);
  });

  it('places a top view on +Y', () => {
    const { position } = computeCameraView(CameraViewType.Top, bounds, { x: 1, y: 0, z: 0 });
    expect(position.x).toBeCloseTo(0);
    expect(position.z).toBeCloseTo(0);
    expect(position.y).toBeGreaterThan(0);
  });

  it('fit preserves the current view direction', () => {
    // Current direction along +X → fitted camera stays on the +X axis.
    const { position } = computeCameraView(CameraViewType.Fit, bounds, { x: 10, y: 0, z: 0 });
    expect(position.y).toBeCloseTo(0);
    expect(position.z).toBeCloseTo(0);
    expect(position.x).toBeGreaterThan(0);
  });

  it('a larger bound pushes the camera farther away', () => {
    const near = computeCameraView(CameraViewType.Front, bounds, { x: 0, y: 0, z: 1 }).position.z;
    const bigBounds = { ...bounds, radius: 10 };
    const far = computeCameraView(CameraViewType.Front, bigBounds, { x: 0, y: 0, z: 1 }).position.z;
    expect(far).toBeGreaterThan(near);
  });

  it('frames the sphere within the vertical FOV (distance ≈ r/sin(fov/2)·margin)', () => {
    const fov = 45;
    const margin = 1.25;
    const { position } = computeCameraView(CameraViewType.Front, bounds, { x: 0, y: 0, z: 1 }, fov, margin);
    const expected = (bounds.radius / Math.sin((fov * Math.PI) / 180 / 2)) * margin;
    expect(position.z).toBeCloseTo(expected);
  });
});
