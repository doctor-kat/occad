import * as THREE from 'three';
import { SketchPlane, PlaneType, Workplane } from '@/cad/types';

/**
 * Get transformation matrix from a planegcs Workplane (origin + basis vectors)
 */
export function getWorkplaneTransform(workplane: Workplane): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  const xAxis = new THREE.Vector3(workplane.xAxis.x, workplane.xAxis.y, workplane.xAxis.z);
  const yAxis = new THREE.Vector3(workplane.yAxis.x, workplane.yAxis.y, workplane.yAxis.z);
  const normal = new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z);
  matrix.makeBasis(xAxis, yAxis, normal);
  matrix.setPosition(workplane.origin.x, workplane.origin.y, workplane.origin.z);
  return matrix;
}

/**
 * Get transformation matrix for sketch plane
 */
export function getPlaneTransform(plane: SketchPlane): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();

  switch (plane.type) {
    case PlaneType.XY:
      // Default orientation (XY plane at Z=0 or offset)
      matrix.identity();
      if (plane.offset) {
        matrix.setPosition(0, 0, plane.offset);
      }
      break;
    case PlaneType.XZ:
      // XZ plane (Top Plane): sketch X→world X, sketch Y→world Z
      // Matches worker mapping: sketchPointTo3D maps (x,y) → (x, offset, y)
      // Use -90° rotation so Local Y = World Z (not World -Z)
      matrix.makeRotationX(-Math.PI / 2);
      if (plane.offset) {
        matrix.setPosition(0, plane.offset, 0);
      }
      break;
    case PlaneType.YZ:
      // YZ plane (Right Plane): sketch X→world Y, sketch Y→world Z
      // Matches worker mapping: sketchPointTo3D maps (x,y) → (offset, x, y)
      matrix.makeBasis(
        new THREE.Vector3(0, 1, 0),  // local X → world Y
        new THREE.Vector3(0, 0, 1),  // local Y → world Z
        new THREE.Vector3(1, 0, 0),  // local Z → world X (normal)
      );
      if (plane.offset) {
        matrix.setPosition(plane.offset, 0, 0);
      }
      break;
    case PlaneType.CUSTOM:
      // Custom plane: create transformation from origin and normal
      if (plane.origin && plane.normal) {
        const origin = new THREE.Vector3(plane.origin.x, plane.origin.y, plane.origin.z);
        const normal = new THREE.Vector3(plane.normal.x, plane.normal.y, plane.normal.z).normalize();

        // Create an arbitrary perpendicular vector for X axis
        let xAxis: THREE.Vector3;
        if (Math.abs(normal.x) < 0.9) {
          xAxis = new THREE.Vector3(1, 0, 0).cross(normal).normalize();
        } else {
          xAxis = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
        }

        // Y axis is perpendicular to both
        const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();

        // Create basis matrix
        matrix.makeBasis(xAxis, yAxis, normal);
        matrix.setPosition(origin);
      } else {
        // Fallback to XY plane if custom plane data is incomplete
        matrix.identity();
      }
      break;
    case PlaneType.FACE:
      // TODO: Get face plane from OpenCascade face geometry
      // For now, default to XY plane
      matrix.identity();
      break;
    default:
      matrix.identity();
  }

  return matrix;
}
