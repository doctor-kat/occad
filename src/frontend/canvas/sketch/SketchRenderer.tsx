import { useRef } from 'react';
import { Line, Sphere } from '@react-three/drei';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { Sketch } from '@/cad/types/sketch/Sketch';
import { SketchElementType } from '@/cad/types/sketch/SketchElementType';
import { Point2D } from '@/cad/types/geometry/Point2D';
import { SketchPoint } from '@/cad/types/sketch/SketchPoint';
import { SketchPlane } from '@/cad/types/sketch/SketchPlane/SketchPlane';

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

  // For simplicity, handle only XY plane for now, expand for others later
  if (sketchPlane.type === 'XY') {
    return new Vector3(currentX, currentY, offset);
  } else if (sketchPlane.type === 'custom' && sketchPlane.origin && sketchPlane.normal) {
    // Reimplement the transformation logic from worker's sketchPointTo3D
    // to ensure consistency. This is a simplified version.
    // Full transformation involves constructing a local coordinate system.
    // For now, let's just project along normal from origin for custom planes.
    // This needs to be robustly implemented later.
    return origin.clone().add(new Vector3(currentX, currentY, 0).applyQuaternion(new Vector3(0,0,1).cross(normal).normalize().multiplyScalar(currentX).add(new Vector3().crossVectors(normal, new Vector3(0,0,1)).normalize().multiplyScalar(currentY))));
  }

  return new Vector3(currentX, currentY, offset); // Fallback
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
      // TODO: Add cases for other SketchElementTypes (Circle, Arc, etc.)
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
