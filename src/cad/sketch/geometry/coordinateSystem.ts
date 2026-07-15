import { Point2D, Point3D, Workplane } from '@/cad/types';

/**
 * lift({x,y}, workplane) → Point3D — computes origin + x*Xdir + y*Ydir
 */
export function lift(p2d: Point2D, workplane: Workplane): Point3D {
  return {
    x: workplane.origin.x + p2d.x * workplane.xAxis.x + p2d.y * workplane.yAxis.x,
    y: workplane.origin.y + p2d.x * workplane.xAxis.y + p2d.y * workplane.yAxis.y,
    z: workplane.origin.z + p2d.x * workplane.xAxis.z + p2d.y * workplane.yAxis.z,
  };
}

/**
 * project(Point3D, workplane) → Point2D — dots the offset vector against X and Y directions
 */
export function project(p3d: Point3D, workplane: Workplane): Point2D {
  const dx = p3d.x - workplane.origin.x;
  const dy = p3d.y - workplane.origin.y;
  const dz = p3d.z - workplane.origin.z;

  return {
    x: dx * workplane.xAxis.x + dy * workplane.xAxis.y + dz * workplane.xAxis.z,
    y: dx * workplane.yAxis.x + dy * workplane.yAxis.y + dz * workplane.yAxis.z,
  };
}
