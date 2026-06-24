import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Sketch, SketchElement, Point2D } from '@/cad/types';
import { SketchOperation, SketchElementType } from '@/cad/types';
import { getWorkplaneTransform } from './getPlaneTransform';
import { SketchElementRenderer3D } from './SketchElementRenderer3D';
import { SketchHotkeys } from './SketchHotkeys';
import { useViewportStore } from '@/frontend/shared/viewportStore';

/**
 * No-op raycast: makes a mesh/line render but never be an intersection target.
 * Every sketch decoration (grid, axes, hover/snap/construction indicators,
 * element/preview lines) uses this so it can't sit under the cursor and swallow
 * a click meant for the sketch plane. Element hover/selection is computed from
 * 2D distance math on pointer-move, not from raycasting these objects, so making
 * them non-interactive costs nothing. Only the plane and the point-selection
 * handles remain real pointer targets.
 */
const NO_RAYCAST = () => null;

/** Project a point onto a line segment; returns the projection and distance. */
function projectPointOntoLineSegment(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D
): { projection: Point2D; distance: number } {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const distance = Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
    return { projection: lineStart, distance };
  }

  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projection: Point2D = { x: lineStart.x + t * dx, y: lineStart.y + t * dy };
  const distance = Math.sqrt(
    Math.pow(point.x - projection.x, 2) + Math.pow(point.y - projection.y, 2)
  );
  return { projection, distance };
}

/**
 * Distance from a 2D point to a sketch element (for hover/selection). Pure —
 * hoisted to module scope so the pointer handlers that use it stay referentially
 * stable across renders (see `currentPointsRef`).
 */
function getDistanceToElement(point: Point2D, element: SketchElement): number {
  switch (element.type) {
    case SketchElementType.LINE: {
      const { distance } = projectPointOntoLineSegment(point, element.start, element.end);
      return distance;
    }

    case SketchElementType.RECTANGLE: {
      const edges: [Point2D, Point2D][] = [
        [element.corner1, { x: element.corner2.x, y: element.corner1.y }],
        [{ x: element.corner2.x, y: element.corner1.y }, element.corner2],
        [element.corner2, { x: element.corner1.x, y: element.corner2.y }],
        [{ x: element.corner1.x, y: element.corner2.y }, element.corner1],
      ];
      let minDistance = Infinity;
      edges.forEach(([start, end]) => {
        const { distance } = projectPointOntoLineSegment(point, start, end);
        minDistance = Math.min(minDistance, distance);
      });
      return minDistance;
    }

    case SketchElementType.CIRCLE: {
      const distToCenter = Math.sqrt(
        Math.pow(point.x - element.center.x, 2) + Math.pow(point.y - element.center.y, 2)
      );
      return Math.abs(distToCenter - element.radius);
    }

    case SketchElementType.POLYGON: {
      if (element.points.length < 2) return Infinity;
      let minDistance = Infinity;
      for (let i = 0; i < element.points.length; i++) {
        const start = element.points[i];
        const end = element.points[(i + 1) % element.points.length];
        const { distance } = projectPointOntoLineSegment(point, start, end);
        minDistance = Math.min(minDistance, distance);
      }
      return minDistance;
    }

    case SketchElementType.ARC: {
      if (element.points && element.points.length === 3) {
        let minDistance = Infinity;
        element.points.forEach((p) => {
          const dist = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2));
          minDistance = Math.min(minDistance, dist);
        });
        return minDistance;
      }
      return Infinity;
    }

    default:
      return Infinity;
  }
}

export interface SketchOverlayProps {
  sketch: Sketch;
  activeOperation: SketchOperation | null;
  activeConstraint?: string;
  onElementsChange: (sketchId: string, elements: SketchElement[]) => void;
  onBackgroundClick?: () => void;
}

/**
 * SketchOverlay - Renders sketch elements in 3D space on a plane
 */
export function SketchOverlay({
  sketch,
  activeOperation,
  activeConstraint = 'none',
  onElementsChange,
  onBackgroundClick,
}: SketchOverlayProps) {
  const [currentPoints, setCurrentPoints] = useState<Point2D[]>([]);
  // Mirror of `currentPoints` for the pointer handlers to read. The handlers are
  // attached to the R3F plane mesh; if they closed over `currentPoints` directly
  // they'd need it in their dependency list, get a new identity the moment the
  // first point is placed, and force R3F to re-bind the mesh's event handlers —
  // which drops every subsequent pointer event and silently breaks any
  // multi-click tool (rectangle, line, polygon, arc). Reading from a ref keeps
  // the handlers stable across clicks. `setPoints` updates ref + state together.
  const currentPointsRef = useRef<Point2D[]>([]);
  const setPoints = useCallback(
    (next: Point2D[] | ((prev: Point2D[]) => Point2D[])) => {
      const value = typeof next === 'function'
        ? (next as (p: Point2D[]) => Point2D[])(currentPointsRef.current)
        : next;
      currentPointsRef.current = value;
      setCurrentPoints(value);
    },
    []
  );
  const [previewElement, setPreviewElement] = useState<SketchElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null);
  const [snapPoint2D, setSnapPoint2D] = useState<Point2D | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  // Sketch element selection lives in the shared viewport store so the constraint
  // toolbar (rendered outside the R3F canvas) can read it.
  const selectedSketchElementIds = useViewportStore((s) => s.selectedSketchElementIds);
  const toggleSketchElementSelection = useViewportStore((s) => s.toggleSketchElementSelection);
  const clearSketchSelection = useViewportStore((s) => s.clearSketchSelection);
  const selectedElementIds = useMemo(() => new Set(selectedSketchElementIds), [selectedSketchElementIds]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const planeRef = useRef<THREE.Mesh>(null);

  const gridSize = 10;
  const snapDistance = 5; // Distance threshold for snapping to points/edges
  const hoverThreshold = 3; // Distance threshold for element hover detection

  // Calculate plane transformation
  const planeTransform = useMemo(() => getWorkplaneTransform(sketch.workplane), [sketch.workplane]);

  // Clear selection when switching INTO a drawing tool (selection is only meaningful in
  // selection mode). Guarding on activeOperation avoids wiping a deliberate selection on
  // incidental remounts (e.g. a rebuild) while in selection mode.
  useEffect(() => {
    if (activeOperation) {
      clearSketchSelection();
      setHoveredElementId(null);
    }
  }, [activeOperation, clearSketchSelection]);

  // Complete polygon (for polygon operation)
  const handleCompletePolygon = useCallback(() => {
    const points = currentPointsRef.current;
    if (activeOperation === SketchOperation.POLYGON && points.length >= 3) {
      const newPolygon: SketchElement = {
        type: SketchElementType.POLYGON,
        id: crypto.randomUUID(),
        points,
      };
      onElementsChange(sketch.id, [...sketch.elements, newPolygon]);
      setPoints([]);
      setPreviewElement(null);
    }
  }, [activeOperation, sketch.elements, sketch.id, onElementsChange, setPoints]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle grid snap
      if (e.key === 'g' || e.key === 'G') {
        setSnapToGrid((prev) => !prev);
        return;
      }

      // Complete polygon
      if (e.key === 'Enter') {
        handleCompletePolygon();
        return;
      }

      // Cancel current drawing
      if (e.key === 'Escape') {
        if (currentPointsRef.current.length > 0) {
          setPoints([]);
          setPreviewElement(null);
        } else {
          // If no drawing in progress, clear selection
          clearSketchSelection();
        }
        return;
      }

      // Deletion
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.size > 0) {
          // Prevent default browser behavior
          e.preventDefault();

          // Filter out selected elements
          const newElements = sketch.elements.filter(
            (element) => !selectedElementIds.has(element.id)
          );
          onElementsChange(sketch.id, newElements);

          // Clear selection
          clearSketchSelection();
          setHoveredElementId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, sketch.elements, sketch.id, onElementsChange, handleCompletePolygon, clearSketchSelection, setPoints]);

  // Origin crosshair geometries (memoised to avoid per-render allocation)
  const xAxisGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints([new THREE.Vector3(-50, 0, 0), new THREE.Vector3(50, 0, 0)]);
    return geo;
  }, []);

  const yAxisGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints([new THREE.Vector3(0, -50, 0), new THREE.Vector3(0, 50, 0)]);
    return geo;
  }, []);

  // Get all snap points from existing sketch elements
  const snapPoints = useMemo(() => {
    const points: Point2D[] = [];
    sketch.elements.forEach((element) => {
      switch (element.type) {
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
        case SketchElementType.RECTANGLE:
          const { corner1, corner2 } = element;
          // Four edges of rectangle
          midpoints.push({ x: (corner1.x + corner2.x) / 2, y: corner1.y });
          midpoints.push({ x: (corner1.x + corner2.x) / 2, y: corner2.y });
          midpoints.push({ x: corner1.x, y: (corner1.y + corner2.y) / 2 });
          midpoints.push({ x: corner2.x, y: (corner1.y + corner2.y) / 2 });
          break;
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
          let minDistance = snapDistance;

          sketch.elements.forEach((element) => {
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
      let minDistance = snapDistance;

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
    [activeConstraint, snapPoints, edgeMidpoints, circleCenters, snapDistance, sketch.elements]
  );

  // Snap point to grid or constraint
  const snapPoint = useCallback(
    (point: Point2D): Point2D => {
      // First try constraint snapping
      if (activeConstraint !== 'none') {
        const constraintSnap = findSnapPoint(point);
        if (constraintSnap) {
          setSnapPoint2D(constraintSnap);
          return constraintSnap;
        }
      }

      setSnapPoint2D(null);

      // Fall back to grid snapping
      if (!snapToGrid) return point;
      return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
      };
    },
    [gridSize, snapToGrid, activeConstraint, findSnapPoint]
  );

  // Handle clicks on the sketch plane
  const handlePlaneClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();

      // Get 2D point on sketch plane
      const point = event.point;
      const localPoint = point.clone().applyMatrix4(planeTransform.clone().invert());
      const point2D: Point2D = { x: localPoint.x, y: localPoint.y };

      // If no operation is active, handle selection
      if (!activeOperation) {
        if (hoveredElementId) {
          // Toggle the hovered element in the selection (multi-select for constraints)
          toggleSketchElementSelection(hoveredElementId);
        } else {
          // Clear selection on empty click
          clearSketchSelection();
        }
        return;
      }

      const snappedPoint = snapPoint(point2D);
      // Read the in-progress points from the ref, never the closure, so this
      // handler stays referentially stable (see currentPointsRef).
      const points = currentPointsRef.current;

      switch (activeOperation) {
        case SketchOperation.LINE:
          if (points.length === 0) {
            setPoints([snappedPoint]);
          } else if (points.length === 1) {
            const newLine: SketchElement = {
              type: SketchElementType.LINE,
              id: crypto.randomUUID(),
              start: points[0],
              end: snappedPoint,
            };
            onElementsChange(sketch.id, [...sketch.elements, newLine]);
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.RECTANGLE:
          if (points.length === 0) {
            setPoints([snappedPoint]);
          } else if (points.length === 1) {
            const newRect: SketchElement = {
              type: SketchElementType.RECTANGLE,
              id: crypto.randomUUID(),
              corner1: points[0],
              corner2: snappedPoint,
            };
            onElementsChange(sketch.id, [...sketch.elements, newRect]);
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.CIRCLE:
          if (points.length === 0) {
            setPoints([snappedPoint]);
          } else if (points.length === 1) {
            const center = points[0];
            const radius = Math.sqrt(
              Math.pow(snappedPoint.x - center.x, 2) +
              Math.pow(snappedPoint.y - center.y, 2)
            );
            const newCircle: SketchElement = {
              type: SketchElementType.CIRCLE,
              id: crypto.randomUUID(),
              center,
              radius,
            };
            onElementsChange(sketch.id, [...sketch.elements, newCircle]);
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.POLYGON:
          setPoints([...points, snappedPoint]);
          break;

        case SketchOperation.ARC:
          if (points.length < 2) {
            setPoints([...points, snappedPoint]);
          } else if (points.length === 2) {
            const newArc: SketchElement = {
              type: SketchElementType.ARC,
              id: crypto.randomUUID(),
              points: [points[0], points[1], snappedPoint],
            };
            onElementsChange(sketch.id, [...sketch.elements, newArc]);
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        default:
          console.warn(`Operation ${activeOperation} not yet implemented`);
      }
    },
    [activeOperation, sketch, onElementsChange, snapPoint, planeTransform, hoveredElementId, toggleSketchElementSelection, clearSketchSelection, setPoints]
  );

  // Handle mouse move for preview
  const handlePlaneMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const point = event.point;
      const localPoint = point.clone().applyMatrix4(planeTransform.clone().invert());
      const point2D: Point2D = { x: localPoint.x, y: localPoint.y };

      // If no operation is active, detect hover for selection
      if (!activeOperation) {
        setPreviewElement(null);
        setHoverPoint(null);

        // Find nearest element within hover threshold
        let nearestElement: SketchElement | null = null;
        let minDistance = hoverThreshold;

        sketch.elements.forEach((element) => {
          const distance = getDistanceToElement(point2D, element);
          if (distance < minDistance) {
            minDistance = distance;
            nearestElement = element;
          }
        });

        setHoveredElementId(nearestElement ? (nearestElement as SketchElement).id : null);
        return;
      }

      const snappedPoint = snapPoint(point2D);
      const points = currentPointsRef.current;

      setHoverPoint(snappedPoint);
      setHoveredElementId(null); // Clear hover when drawing

      if (points.length === 0) {
        setPreviewElement(null);
        return;
      }

      switch (activeOperation) {
        case SketchOperation.LINE:
          if (points.length === 1) {
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start: points[0],
              end: snappedPoint,
            } as SketchElement);
          }
          break;

        case SketchOperation.RECTANGLE:
          if (points.length === 1) {
            setPreviewElement({
              type: SketchElementType.RECTANGLE,
              id: 'preview',
              corner1: points[0],
              corner2: snappedPoint,
            } as SketchElement);
          }
          break;

        case SketchOperation.CIRCLE:
          if (points.length === 1) {
            const center = points[0];
            const radius = Math.sqrt(
              Math.pow(snappedPoint.x - center.x, 2) +
              Math.pow(snappedPoint.y - center.y, 2)
            );
            setPreviewElement({
              type: SketchElementType.CIRCLE,
              id: 'preview',
              center,
              radius,
            } as SketchElement);
          }
          break;
      }
    },
    [activeOperation, snapPoint, planeTransform, hoverThreshold, sketch.elements]
  );

  return (
    <group matrix={planeTransform} matrixAutoUpdate={false}>
      {/* Hotkeys panel */}
      <SketchHotkeys
        activeOperation={activeOperation}
        currentPointsCount={currentPoints.length}
        snapToGrid={snapToGrid}
      />

      {/* Semi-transparent sketch plane */}
      <mesh
        ref={planeRef}
        position={[0, 0, 0.01]}
        onClick={handlePlaneClick}
        onPointerMove={handlePlaneMove}
        onPointerLeave={() => setHoverPoint(null)}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Grid on sketch plane */}
      <gridHelper
        args={[200, 200 / gridSize, '#6366f1', '#444466']}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.01]}
        raycast={NO_RAYCAST}
      />

      {/* Origin crosshair — red X, green Y */}
      <line geometry={xAxisGeo} position={[0, 0, 0.02]} renderOrder={1000} raycast={NO_RAYCAST}>
        <lineBasicMaterial color="#ef4444" transparent opacity={0.35} depthTest={false} />
      </line>
      <line geometry={yAxisGeo} position={[0, 0, 0.02]} renderOrder={1000} raycast={NO_RAYCAST}>
        <lineBasicMaterial color="#22c55e" transparent opacity={0.35} depthTest={false} />
      </line>
      {/* Origin dot */}
      <mesh position={[0, 0, 0.03]} renderOrder={1001} raycast={NO_RAYCAST}>
        <circleGeometry args={[1.5, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthTest={false} />
      </mesh>

      {/* Render existing sketch elements */}
      {sketch.elements.map((element) => {
        const isHovered = hoveredElementId === element.id;
        const isSelected = selectedElementIds.has(element.id);
        return (
          <SketchElementRenderer3D
            key={element.id}
            element={element}
            color="#7c93c3"
            lineWidth={2}
            isHovered={isHovered}
            isSelected={isSelected}
          />
        );
      })}

      {/* Endpoint/center handles for point-level selection (coincident/distance).
          Only in selection mode (no active drawing operation). */}
      {!activeOperation && sketch.primitives
        ?.filter((p) => p.type === 'point' && !p.isExternal && p.data && typeof p.data.x === 'number')
        .map((p) => {
          const isSel = selectedElementIds.has(p.id);
          return (
            <mesh
              key={`handle-${p.id}`}
              position={[p.data.x, p.data.y, 0.2]}
              renderOrder={1002}
              onClick={(e) => {
                e.stopPropagation();
                toggleSketchElementSelection(p.id);
              }}
            >
              <circleGeometry args={[isSel ? 1.6 : 1.1, 20]} />
              <meshBasicMaterial color={isSel ? '#f97316' : '#94a3b8'} transparent opacity={isSel ? 0.95 : 0.6} depthTest={false} />
            </mesh>
          );
        })}

      {/* Render preview element */}
      {previewElement && (
        <SketchElementRenderer3D element={previewElement} color="#fbbf24" opacity={0.7} lineWidth={2} />
      )}

      {/* Render current construction points */}
      {currentPoints.map((point, index) => (
        <mesh key={index} position={[point.x, point.y, 0.1]} raycast={NO_RAYCAST}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      ))}

      {/* Render hover point indicator */}
      {hoverPoint && activeOperation && (
        <mesh position={[hoverPoint.x, hoverPoint.y, 0.1]} raycast={NO_RAYCAST}>
          <circleGeometry args={[0.8, 16]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} />
        </mesh>
      )}

      {/* Render snap point indicator (when snapped to a constraint) */}
      {snapPoint2D && activeOperation && (
        <group position={[snapPoint2D.x, snapPoint2D.y, 0.15]}>
          {/* Outer ring */}
          <mesh raycast={NO_RAYCAST}>
            <ringGeometry args={[1.5, 2, 16]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
          </mesh>
          {/* Center dot */}
          <mesh raycast={NO_RAYCAST}>
            <circleGeometry args={[0.5, 16]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>
      )}

      {/* Render available snap points based on active constraint */}
      {activeConstraint === 'point' && snapPoints.map((point, index) => (
        <mesh key={`snap-${index}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <circleGeometry args={[0.6, 8]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
        </mesh>
      ))}

      {activeConstraint === 'midpoint' && edgeMidpoints.map((point, index) => (
        <mesh key={`midpoint-${index}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <boxGeometry args={[1.2, 1.2, 0.1]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} />
        </mesh>
      ))}

      {activeConstraint === 'center' && circleCenters.map((point, index) => (
        <mesh key={`center-${index}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <ringGeometry args={[0.8, 1.2, 16]} />
          <meshBasicMaterial color="#ec4899" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Highlight edges when edge constraint is active */}
      {activeConstraint === 'edge' && sketch.elements.map((element, index) => {
        if (element.type === SketchElementType.LINE) {
          return (
            <SketchElementRenderer3D
              key={`edge-highlight-${index}`}
              element={element}
              color="#f97316"
              opacity={0.5}
              lineWidth={3}
            />
          );
        } else if (element.type === SketchElementType.RECTANGLE) {
          return (
            <SketchElementRenderer3D
              key={`edge-highlight-${index}`}
              element={element}
              color="#f97316"
              opacity={0.5}
              lineWidth={3}
            />
          );
        }
        return null;
      })}
    </group>
  );
}
