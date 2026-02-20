import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Sketch, SketchElement, Point2D, SketchPlane } from '@/cad/types';
import { SketchTool, PlaneType, SketchElementType } from '@/cad/types';

interface SketchOverlayProps {
  sketch: Sketch;
  activeTool: SketchTool | null;
  activeConstraint?: string;
  onElementsChange: (sketchId: string, elements: SketchElement[]) => void;
  onBackgroundClick?: () => void;
}

/**
 * Get transformation matrix for sketch plane
 */
function getPlaneTransform(plane: SketchPlane): THREE.Matrix4 {
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

/**
 * SketchOverlay - Renders sketch elements in 3D space on a plane
 */
export function SketchOverlay({
  sketch,
  activeTool,
  activeConstraint = 'none',
  onElementsChange,
  onBackgroundClick,
}: SketchOverlayProps) {
  const [currentPoints, setCurrentPoints] = useState<Point2D[]>([]);
  const [previewElement, setPreviewElement] = useState<SketchElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null);
  const [snapPoint2D, setSnapPoint2D] = useState<Point2D | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const { raycaster, camera } = useThree();
  const planeRef = useRef<THREE.Mesh>(null);

  const gridSize = 10;
  const snapToGrid = true; // TODO: Make this configurable
  const snapDistance = 5; // Distance threshold for snapping to points/edges
  const hoverThreshold = 3; // Distance threshold for element hover detection

  // Calculate plane transformation
  const planeTransform = useMemo(() => getPlaneTransform(sketch.plane), [sketch.plane]);

  // Clear selection when tool changes or sketch exits
  useEffect(() => {
    setSelectedElementIds(new Set());
    setHoveredElementId(null);
  }, [activeTool]);

  // Handle keyboard events for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle delete if we're in sketch mode (no active tool or any tool active)
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
          setSelectedElementIds(new Set());
          setHoveredElementId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, sketch.elements, sketch.id, onElementsChange]);

  // Origin crosshair geometries (memoised to avoid per-render allocation)
  const xAxisGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints([new THREE.Vector3(-100, 0, 0), new THREE.Vector3(100, 0, 0)]);
    return geo;
  }, []);

  const yAxisGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints([new THREE.Vector3(0, -100, 0), new THREE.Vector3(0, 100, 0)]);
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

  // Project point onto line segment
  const projectPointOntoLineSegment = (
    point: Point2D,
    lineStart: Point2D,
    lineEnd: Point2D
  ): { projection: Point2D; distance: number } => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Line segment is a point
      const distance = Math.sqrt(
        Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
      );
      return { projection: lineStart, distance };
    }

    // Calculate parameter t (0 to 1) for the projection point
    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]

    const projection: Point2D = {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy,
    };

    const distance = Math.sqrt(
      Math.pow(point.x - projection.x, 2) + Math.pow(point.y - projection.y, 2)
    );

    return { projection, distance };
  };

  // Calculate distance from point to sketch element
  const getDistanceToElement = (point: Point2D, element: SketchElement): number => {
    switch (element.type) {
      case SketchElementType.LINE: {
        const { distance } = projectPointOntoLineSegment(point, element.start, element.end);
        return distance;
      }

      case SketchElementType.RECTANGLE: {
        // Calculate distance to each of the four edges
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
        // Distance to circle is |distance_to_center - radius|
        const distToCenter = Math.sqrt(
          Math.pow(point.x - element.center.x, 2) + Math.pow(point.y - element.center.y, 2)
        );
        return Math.abs(distToCenter - element.radius);
      }

      case SketchElementType.POLYGON: {
        // Distance to nearest edge of polygon
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
        // Simplified: distance to any of the three points (proper arc distance is more complex)
        if (element.points && element.points.length === 3) {
          let minDistance = Infinity;
          element.points.forEach((p) => {
            const dist = Math.sqrt(
              Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2)
            );
            minDistance = Math.min(minDistance, dist);
          });
          return minDistance;
        }
        return Infinity;
      }

      default:
        return Infinity;
    }
  };

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
      console.log(`[SketchOverlay] 3D world (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}) → 2D sketch (${point2D.x.toFixed(2)}, ${point2D.y.toFixed(2)})`);

      // If no tool is active, handle selection
      if (!activeTool) {
        if (hoveredElementId) {
          // Select the hovered element
          setSelectedElementIds(new Set([hoveredElementId]));
        } else {
          // Clear selection on empty click
          setSelectedElementIds(new Set());
        }
        return;
      }

      const snappedPoint = snapPoint(point2D);

      switch (activeTool) {
        case SketchTool.LINE:
          if (currentPoints.length === 0) {
            setCurrentPoints([snappedPoint]);
          } else if (currentPoints.length === 1) {
            const newLine: SketchElement = {
              type: SketchElementType.LINE,
              id: crypto.randomUUID(),
              start: currentPoints[0],
              end: snappedPoint,
            };
            onElementsChange(sketch.id, [...sketch.elements, newLine]);
            setCurrentPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchTool.RECTANGLE:
          if (currentPoints.length === 0) {
            setCurrentPoints([snappedPoint]);
          } else if (currentPoints.length === 1) {
            const newRect: SketchElement = {
              type: SketchElementType.RECTANGLE,
              id: crypto.randomUUID(),
              corner1: currentPoints[0],
              corner2: snappedPoint,
            };
            onElementsChange(sketch.id, [...sketch.elements, newRect]);
            setCurrentPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchTool.CIRCLE:
          if (currentPoints.length === 0) {
            setCurrentPoints([snappedPoint]);
          } else if (currentPoints.length === 1) {
            const center = currentPoints[0];
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
            setCurrentPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchTool.POLYGON:
          setCurrentPoints([...currentPoints, snappedPoint]);
          break;

        case SketchTool.ARC:
          if (currentPoints.length < 2) {
            setCurrentPoints([...currentPoints, snappedPoint]);
          } else if (currentPoints.length === 2) {
            const newArc: SketchElement = {
              type: SketchElementType.ARC,
              id: crypto.randomUUID(),
              points: [currentPoints[0], currentPoints[1], snappedPoint],
            };
            onElementsChange(sketch.id, [...sketch.elements, newArc]);
            setCurrentPoints([]);
            setPreviewElement(null);
          }
          break;

        default:
          console.warn(`Tool ${activeTool} not yet implemented`);
      }
    },
    [activeTool, currentPoints, sketch, onElementsChange, snapPoint, planeTransform, hoveredElementId]
  );

  // Handle mouse move for preview
  const handlePlaneMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const point = event.point;
      const localPoint = point.clone().applyMatrix4(planeTransform.clone().invert());
      const point2D: Point2D = { x: localPoint.x, y: localPoint.y };

      // If no tool is active, detect hover for selection
      if (!activeTool) {
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

        setHoveredElementId(nearestElement ? nearestElement.id : null);
        return;
      }

      const snappedPoint = snapPoint(point2D);

      setHoverPoint(snappedPoint);
      setHoveredElementId(null); // Clear hover when drawing

      if (currentPoints.length === 0) {
        setPreviewElement(null);
        return;
      }

      switch (activeTool) {
        case SketchTool.LINE:
          if (currentPoints.length === 1) {
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start: currentPoints[0],
              end: snappedPoint,
            } as SketchElement);
          }
          break;

        case SketchTool.RECTANGLE:
          if (currentPoints.length === 1) {
            setPreviewElement({
              type: SketchElementType.RECTANGLE,
              id: 'preview',
              corner1: currentPoints[0],
              corner2: snappedPoint,
            } as SketchElement);
          }
          break;

        case SketchTool.CIRCLE:
          if (currentPoints.length === 1) {
            const center = currentPoints[0];
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
    [activeTool, currentPoints, snapPoint, planeTransform, hoverThreshold, sketch.elements, getDistanceToElement]
  );

  return (
    <group matrix={planeTransform} matrixAutoUpdate={false}>
      {/* Hotkeys panel */}
      <Html
        position={[0, 0, 0]}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          transform: 'none',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ opacity: 0.6 }}>Hotkeys:</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <kbd style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: 3,
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}>DEL</kbd>
              <span style={{ opacity: 0.7 }}>Delete selected</span>
            </div>
          </div>
        </div>
      </Html>
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
      />

      {/* Origin crosshair — red X, green Y */}
      <line geometry={xAxisGeo} position={[0, 0, 0.02]}>
        <lineBasicMaterial color="#ef4444" transparent opacity={0.35} />
      </line>
      <line geometry={yAxisGeo} position={[0, 0, 0.02]}>
        <lineBasicMaterial color="#22c55e" transparent opacity={0.35} />
      </line>
      {/* Origin dot */}
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[1.5, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
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

      {/* Render preview element */}
      {previewElement && (
        <SketchElementRenderer3D element={previewElement} color="#fbbf24" opacity={0.7} lineWidth={2} />
      )}

      {/* Render current construction points */}
      {currentPoints.map((point, index) => (
        <mesh key={index} position={[point.x, point.y, 0.1]}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      ))}

      {/* Render hover point indicator */}
      {hoverPoint && activeTool && (
        <mesh position={[hoverPoint.x, hoverPoint.y, 0.1]}>
          <circleGeometry args={[0.8, 16]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} />
        </mesh>
      )}

      {/* Render snap point indicator (when snapped to a constraint) */}
      {snapPoint2D && activeTool && (
        <group position={[snapPoint2D.x, snapPoint2D.y, 0.15]}>
          {/* Outer ring */}
          <mesh>
            <ringGeometry args={[1.5, 2, 16]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
          </mesh>
          {/* Center dot */}
          <mesh>
            <circleGeometry args={[0.5, 16]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>
      )}

      {/* Render available snap points based on active constraint */}
      {activeConstraint === 'point' && snapPoints.map((point, index) => (
        <mesh key={`snap-${index}`} position={[point.x, point.y, 0.12]}>
          <circleGeometry args={[0.6, 8]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
        </mesh>
      ))}

      {activeConstraint === 'midpoint' && edgeMidpoints.map((point, index) => (
        <mesh key={`midpoint-${index}`} position={[point.x, point.y, 0.12]}>
          <boxGeometry args={[1.2, 1.2, 0.1]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} />
        </mesh>
      ))}

      {activeConstraint === 'center' && circleCenters.map((point, index) => (
        <mesh key={`center-${index}`} position={[point.x, point.y, 0.12]}>
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

/**
 * Renders a single sketch element in 3D space
 */
function SketchElementRenderer3D({
  element,
  color,
  opacity = 1,
  lineWidth = 2,
  isHovered = false,
  isSelected = false,
}: {
  element: SketchElement;
  color: string;
  opacity?: number;
  lineWidth?: number;
  isHovered?: boolean;
  isSelected?: boolean;
}) {
  // Determine color and width based on state
  let finalColor = color;
  let finalLineWidth = lineWidth;

  if (isSelected) {
    finalColor = '#fbbf24'; // Yellow/gold for selection
    finalLineWidth = lineWidth + 1;
  } else if (isHovered) {
    finalColor = '#60a5fa'; // Blue for hover
    finalLineWidth = lineWidth + 1;
  }

  const points: THREE.Vector3[] = [];

  switch (element.type) {
    case SketchElementType.LINE:
      points.push(
        new THREE.Vector3(element.start.x, element.start.y, 0),
        new THREE.Vector3(element.end.x, element.end.y, 0)
      );
      break;

    case SketchElementType.RECTANGLE: {
      const { corner1, corner2 } = element;
      points.push(
        new THREE.Vector3(corner1.x, corner1.y, 0),
        new THREE.Vector3(corner2.x, corner1.y, 0),
        new THREE.Vector3(corner2.x, corner2.y, 0),
        new THREE.Vector3(corner1.x, corner2.y, 0),
        new THREE.Vector3(corner1.x, corner1.y, 0)
      );
      break;
    }

    case SketchElementType.CIRCLE: {
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(
          new THREE.Vector3(
            element.center.x + Math.cos(angle) * element.radius,
            element.center.y + Math.sin(angle) * element.radius,
            0
          )
        );
      }
      break;
    }

    case SketchElementType.POLYGON:
      element.points.forEach((p) => {
        points.push(new THREE.Vector3(p.x, p.y, 0));
      });
      if (element.points.length > 0) {
        const first = element.points[0];
        points.push(new THREE.Vector3(first.x, first.y, 0));
      }
      break;

    case SketchElementType.ARC:
      // TODO: Implement proper arc rendering with 3 points
      if (element.points && element.points.length === 3) {
        element.points.forEach((p) => {
          points.push(new THREE.Vector3(p.x, p.y, 0));
        });
      }
      break;

    // TODO: Implement ellipse, spline, bezier rendering
  }

  if (points.length === 0) return null;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line geometry={geometry} position={[0, 0, 0.05]}>
      <lineBasicMaterial color={finalColor} opacity={opacity} transparent linewidth={finalLineWidth} />
    </line>
  );
}
