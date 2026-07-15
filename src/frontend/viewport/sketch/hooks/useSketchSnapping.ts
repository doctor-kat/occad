import { useCallback, useMemo, useState } from 'react';
import type { Point2D, Sketch, SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import { projectPointOntoLineSegment } from '@/cad/sketch/interaction';

const GRID_SIZE = 10;
const SNAP_DISTANCE = 5; // Distance threshold for snapping to points/edges

/**
 * Owns grid/constraint snapping for the sketch plane: grid visibility + snap
 * toggle, the derived snap-candidate point sets (vertices/midpoints/centers),
 * and the `snapPoint` function used by both the click and preview handlers.
 */
export function useSketchSnapping(sketch: Sketch, activeConstraint: string) {
  const [snapToGrid, setSnapToGrid] = useState(true);
  // Grid *visibility* — independent of snapping (you can snap to a hidden grid,
  // or show the grid without snapping). Toggled with 'H'.
  const [showGrid, setShowGrid] = useState(true);
  const [snapPoint2D, setSnapPoint2D] = useState<Point2D | null>(null);
  // True while the cursor is snapped to the origin during a draw — drives the
  // "coincident-to-be-added" preview badge shown at the origin.
  const [originSnap, setOriginSnap] = useState(false);

  // Get all snap points from existing sketch elements
  const snapPoints = useMemo(() => {
    const points: Point2D[] = [];
    sketch.elements.forEach((element) => {
      switch (element.type) {
        case SketchElementType.POINT:
          points.push({ x: element.x, y: element.y });
          break;
        case SketchElementType.LINE:
          points.push(element.start, element.end);
          break;
        case SketchElementType.CIRCLE:
          points.push(element.center);
          break;
        case SketchElementType.RECTANGLE:
          points.push(element.corner1, element.corner2);
          points.push({ x: element.corner1.x, y: element.corner2.y });
          points.push({ x: element.corner2.x, y: element.corner1.y });
          break;
        case SketchElementType.POLYGON:
          points.push(...element.points);
          break;
        case SketchElementType.ARC:
          if (element.points) {
            points.push(...element.points);
          }
          if (element.center) {
            points.push(element.center);
          }
          break;
      }
    });
    return points;
  }, [sketch.elements]);

  // Get all edge midpoints from existing sketch elements
  const edgeMidpoints = useMemo(() => {
    const midpoints: Point2D[] = [];
    sketch.elements.forEach((element) => {
      switch (element.type) {
        case SketchElementType.LINE:
          midpoints.push({
            x: (element.start.x + element.end.x) / 2,
            y: (element.start.y + element.end.y) / 2,
          });
          break;
        case SketchElementType.RECTANGLE: {
          const { corner1, corner2 } = element;
          // Four edges of rectangle
          midpoints.push({ x: (corner1.x + corner2.x) / 2, y: corner1.y });
          midpoints.push({ x: (corner1.x + corner2.x) / 2, y: corner2.y });
          midpoints.push({ x: corner1.x, y: (corner1.y + corner2.y) / 2 });
          midpoints.push({ x: corner2.x, y: (corner1.y + corner2.y) / 2 });
          break;
        }
      }
    });
    return midpoints;
  }, [sketch.elements]);

  // Get all circle centers from existing sketch elements
  const circleCenters = useMemo(() => {
    const centers: Point2D[] = [];
    sketch.elements.forEach((element) => {
      if (element.type === SketchElementType.CIRCLE) {
        centers.push(element.center);
      } else if (element.type === SketchElementType.ARC && element.center) {
        centers.push(element.center);
      }
    });
    return centers;
  }, [sketch.elements]);

  // Find nearest snap point based on active constraint
  const findSnapPoint = useCallback(
    (point: Point2D): Point2D | null => {
      let candidatePoints: Point2D[] = [];

      switch (activeConstraint) {
        case 'point':
          candidatePoints = snapPoints;
          break;
        case 'midpoint':
          candidatePoints = edgeMidpoints;
          break;
        case 'center':
          candidatePoints = circleCenters;
          break;
        case 'edge': {
          // Project onto nearest edge
          let closestProjection: Point2D | null = null;
          let minDistance = SNAP_DISTANCE;

          sketch.elements.forEach((element: SketchElement) => {
            if (element.type === SketchElementType.LINE) {
              const { projection, distance } = projectPointOntoLineSegment(
                point,
                element.start,
                element.end
              );
              if (distance < minDistance) {
                minDistance = distance;
                closestProjection = projection;
              }
            } else if (element.type === SketchElementType.RECTANGLE) {
              // Check all four edges of the rectangle
              const edges = [
                [element.corner1, { x: element.corner2.x, y: element.corner1.y }],
                [{ x: element.corner2.x, y: element.corner1.y }, element.corner2],
                [element.corner2, { x: element.corner1.x, y: element.corner2.y }],
                [{ x: element.corner1.x, y: element.corner2.y }, element.corner1],
              ];

              edges.forEach(([start, end]) => {
                const { projection, distance } = projectPointOntoLineSegment(
                  point,
                  start as Point2D,
                  end as Point2D
                );
                if (distance < minDistance) {
                  minDistance = distance;
                  closestProjection = projection;
                }
              });
            }
          });

          return closestProjection;
        }
        case 'none':
        default:
          return null;
      }

      // Find closest point within snap distance
      let closestPoint: Point2D | null = null;
      let minDistance = SNAP_DISTANCE;

      candidatePoints.forEach((candidate) => {
        const distance = Math.sqrt(
          Math.pow(candidate.x - point.x, 2) + Math.pow(candidate.y - point.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = candidate;
        }
      });

      return closestPoint;
    },
    [activeConstraint, snapPoints, edgeMidpoints, circleCenters, sketch.elements]
  );

  // Snap point to grid or constraint
  const snapPoint = useCallback(
    (point: Point2D): Point2D => {
      // First try constraint snapping
      if (activeConstraint !== 'none') {
        const constraintSnap = findSnapPoint(point);
        if (constraintSnap) {
          setSnapPoint2D(constraintSnap);
          setOriginSnap(false);
          return constraintSnap;
        }
      }

      // Origin snapping: always available while placing a point, so drawn geometry
      // can land exactly on (0,0). A coincident-to-origin constraint is then inferred
      // for the endpoint (see originPoint.inferOriginCoincidence).
      if (Math.hypot(point.x, point.y) < SNAP_DISTANCE) {
        setSnapPoint2D({ x: 0, y: 0 });
        setOriginSnap(true);
        return { x: 0, y: 0 };
      }

      setSnapPoint2D(null);
      setOriginSnap(false);

      // Fall back to grid snapping
      if (!snapToGrid) return point;
      return {
        x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
      };
    },
    [snapToGrid, activeConstraint, findSnapPoint]
  );

  const resetSnapIndicators = useCallback(() => {
    setSnapPoint2D(null);
    setOriginSnap(false);
  }, []);

  return {
    gridSize: GRID_SIZE,
    snapDistance: SNAP_DISTANCE,
    snapToGrid,
    setSnapToGrid,
    showGrid,
    setShowGrid,
    snapPoint2D,
    setSnapPoint2D,
    originSnap,
    setOriginSnap,
    snapPoints,
    edgeMidpoints,
    circleCenters,
    snapPoint,
    resetSnapIndicators,
  };
}
