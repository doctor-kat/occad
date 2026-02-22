import { useRef } from 'react';
import { Line, Sphere, Circle } from '@react-three/drei'; // Added Circle
import { BufferGeometry, Float32BufferAttribute, Vector3, Quaternion } from 'three'; // Added Quaternion
import { Sketch } from '@/cad/types/sketch/Sketch';
import { SketchElementType } from '@/cad/types/sketch/SketchElementType';
import { Point2D } from '@/cad/types/geometry/Point2D';
import { SketchPoint } from '@/cad/types/sketch/SketchPoint';
import { SketchPlane } from '@/cad/types/sketch/SketchPlane/SketchPlane';
import { SketchCircle } from '@/cad/types/sketch/SketchCircle'; // New import
import { SketchArc } from '@/cad/types/sketch/SketchArc';     // New import

interface SketchRendererProps {
  sketch: Sketch;
  // TODO: Add props for selected entities, hovered entities, constraint visualization
}

// Helper function to convert 2D sketch point to 3D world coordinates
// This logic should ideally be consistent with the worker's sketchPointTo3D for display accuracy.
const convertSketchPointTo3D = (
  point2D: Point2D,
  sketchPlane: SketchPlane,
  pointsMap: Map<string, SketchPoint> // Use the map for current solved positions
): Vector3 => {
  let currentX = point2D.x;
  let currentY = point2D.y;

  // If this Point2D corresponds to a SketchPoint in the solved points, use its solved coordinates
  if (point2D.id && pointsMap.has(point2D.id)) {
    const solvedPoint = pointsMap.get(point2D.id)!;
    currentX = solvedPoint.x;
    currentY = solvedPoint.y;
  }

  const offset = sketchPlane.offset || 0;
  const origin = new Vector3(sketchPlane.origin.x, sketchPlane.origin.y, sketchPlane.origin.z);
  const normal = new Vector3(sketchPlane.normal.x, sketchPlane.normal.y, sketchPlane.normal.z);

  // Determine an 'up' vector for the plane's orientation
  let upVector = new Vector3(0, 1, 0); // Default up
  if (normal.y > 0.9) { // If normal is close to Y-axis, use Z as up
    upVector = new Vector3(0, 0, 1);
  } else if (normal.y < -0.9) { // If normal is close to negative Y-axis, use Z as up
    upVector = new Vector3(0, 0, 1);
  }

  // Create a quaternion to rotate from default Z-up (0,0,1) to the plane's normal
  const targetNormal = normal.clone().normalize();
  const defaultZ = new Vector3(0, 0, 1);
  const quaternion = new Quaternion().setFromUnitVectors(defaultZ, targetNormal);

  // Position on the plane relative to its origin
  let localPoint = new Vector3(currentX, currentY, 0); // Start in XY plane
  localPoint.applyQuaternion(quaternion); // Rotate into the custom plane's orientation

  return origin.clone().add(localPoint);
};


export function SketchRenderer({ sketch }: SketchRendererProps) {
  const pointsMap = useRef(new Map<string, SketchPoint>());

  // Update points map whenever sketch.points changes
  // This is crucial for lines/arcs to reference the latest solved point positions
  pointsMap.current = new Map(sketch.points.map((p) => [p.id, p]));

  const renderElements = sketch.elements.map((element) => {
    switch (element.type) {
      case SketchElementType.LINE: {
        // Ensure start and end points of the line use solved positions
        const startPoint2D: Point2D = { ...element.start, id: element.start.id || '' };
        const endPoint2D: Point2D = { ...element.end, id: element.end.id || '' };

        const start = convertSketchPointTo3D(startPoint2D, sketch.plane, pointsMap.current);
        const end = convertSketchPointTo3D(endPoint2D, sketch.plane, pointsMap.current);

        return (
          <Line
            key={element.id}
            points={[start.toArray(), end.toArray()]}
            color="hotpink"
            lineWidth={2}
            dashed={false}
          />
        );
      }
      case SketchElementType.POINT: {
        const point = element as SketchPoint;
        const position = convertSketchPointTo3D(point, sketch.plane, pointsMap.current);
        return (
          <Sphere key={point.id} position={position.toArray()} args={[0.2, 16, 16]}>
            <meshBasicMaterial color="blue" />
          </Sphere>
        );
      }
      case SketchElementType.CIRCLE: {
        const circle = element as SketchCircle;
        const centerPoint2D: Point2D = { id: circle.centerId, x: 0, y: 0 }; // x,y dummy, will be overridden
        const center = convertSketchPointTo3D(centerPoint2D, sketch.plane, pointsMap.current);

        // For a wireframe circle, we use a Line to draw its circumference.
        const segments = 64; // Number of segments to approximate the circle
        const circlePoints: number[] = [];
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const x = circle.radius * Math.cos(angle);
          const y = circle.radius * Math.sin(angle);
          const z = 0; // Local z-coordinate on the plane

          // Convert local 2D circle point to 3D world space
          const localPoint = new Vector3(x, y, z);
          const transformedPoint = localPoint.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,0,1), new Vector3().copy(sketch.plane.normal as Vector3).normalize())).add(center);
          circlePoints.push(transformedPoint.x, transformedPoint.y, transformedPoint.z);
        }

        return (
          <Line
            key={circle.id}
            points={circlePoints}
            color="green"
            lineWidth={2}
            dashed={false}
          />
        );
      }
      case SketchElementType.ARC: {
        const arc = element as SketchArc;
        const centerPoint2D: Point2D = { id: arc.centerId, x: 0, y: 0 }; // x,y dummy, will be overridden
        const center = convertSketchPointTo3D(centerPoint2D, sketch.plane, pointsMap.current);

        const startPoint = convertSketchPointTo3D({ id: arc.startPointId, x:0, y:0 }, sketch.plane, pointsMap.current);
        const endPoint = convertSketchPointTo3D({ id: arc.endPointId, x:0, y:0 }, sketch.plane, pointsMap.current);

        // Vectors from center to start/end points in the plane's local XY
        const startVectorLocal = new Vector3().subVectors(startPoint, center);
        const endVectorLocal = new Vector3().subVectors(endPoint, center);

        let startAngle = Math.atan2(startVectorLocal.y, startVectorLocal.x);
        let endAngle = Math.atan2(endVectorLocal.y, endVectorLocal.x);

        // Normalize angles to 0-2PI range
        if (startAngle < 0) startAngle += 2 * Math.PI;
        if (endAngle < 0) endAngle += 2 * Math.PI;

        // Ensure arc sweeps in positive direction
        if (endAngle < startAngle) endAngle += 2 * Math.PI;

        // Generate points along the arc
        const segments = 64;
        const arcPoints: number[] = [];
        for (let i = 0; i <= segments; i++) {
          const angle = startAngle + (i / segments) * (endAngle - startAngle);
          const x = arc.radius * Math.cos(angle);
          const y = arc.radius * Math.sin(angle);
          const z = 0; // Local z-coordinate on the plane

          // Convert local 2D arc point to 3D world space
          const localPoint = new Vector3(x, y, z);
          const transformedPoint = localPoint.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,0,1), new Vector3().copy(sketch.plane.normal as Vector3).normalize())).add(center);
          arcPoints.push(transformedPoint.x, transformedPoint.y, transformedPoint.z);
        }

        return (
          <Line
            key={arc.id}
            points={arcPoints}
            color="purple"
            lineWidth={2}
            dashed={false}
          />
        );
      }
      // TODO: Add cases for other SketchElementTypes (Rectangle, Polygon, Ellipse, Spline, Bezier)
      default:
        return null;
    }
  });

  const renderPoints = sketch.points.map((point) => {
    const position = convertSketchPointTo3D(point, sketch.plane, pointsMap.current);
    return (
      <Sphere key={point.id} position={position.toArray()} args={[0.2, 16, 16]}>
        <meshBasicMaterial color="red" />
      </Sphere>
    );
  });

  return (
    <group>
      {renderElements}
      {renderPoints}
    </group>
  );
}
