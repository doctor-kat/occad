import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrthographicCamera } from '@react-three/drei';
import type { SketchElement, SketchTool, Point2D } from '@/cad/types';
import { Button, Box, Stack, Text, Group, Kbd, useMantineTheme } from '@mantine/core';
import { Check, X } from '@phosphor-icons/react';

interface SketchCanvasProps {
  /** Active sketch tool */
  activeTool: SketchTool | null;
  /** Existing sketch elements to display */
  elements: SketchElement[];
  /** Callback when sketch is updated */
  onElementsChange: (elements: SketchElement[]) => void;
  /** Callback when sketch editing is finished */
  onFinish: () => void;
  /** Callback when sketch editing is cancelled */
  onCancel: () => void;
}

/**
 * 2D Sketch Drawing Component
 *
 * Provides an interactive 2D canvas for drawing sketch geometry using Three.js
 * with orthographic projection for precise 2D interactions.
 */
export function SketchCanvas({
  activeTool,
  elements,
  onElementsChange,
  onFinish,
  onCancel,
}: SketchCanvasProps) {
  const [currentPoints, setCurrentPoints] = useState<Point2D[]>([]);
  const [previewElement, setPreviewElement] = useState<SketchElement | null>(null);
  const [gridSize] = useState(10);
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Snap point to grid
  const snapPoint = useCallback(
    (point: Point2D): Point2D => {
      if (!snapToGrid) return point;
      return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
      };
    },
    [gridSize, snapToGrid]
  );

  // Handle canvas click for adding points
  const handleCanvasClick = useCallback(
    (point: Point2D) => {
      const snappedPoint = snapPoint(point);

      if (!activeTool) return;

      switch (activeTool) {
        case 'line':
          if (currentPoints.length === 0) {
            // First point
            setCurrentPoints([snappedPoint]);
          } else if (currentPoints.length === 1) {
            // Second point - complete line
            const newLine: SketchElement = {
              type: 'line',
              id: crypto.randomUUID(),
              start: currentPoints[0],
              end: snappedPoint,
            };
            onElementsChange([...elements, newLine]);
            setCurrentPoints([]);
            setPreviewElement(null);
          }
          break;

        case 'rectangle':
          if (currentPoints.length === 0) {
            setCurrentPoints([snappedPoint]);
          } else if (currentPoints.length === 1) {
            const newRect: SketchElement = {
              type: 'rectangle',
              id: crypto.randomUUID(),
              corner1: currentPoints[0],
              corner2: snappedPoint,
            };
            onElementsChange([...elements, newRect]);
            setCurrentPoints([]);
            setPreviewElement(null);
          }
          break;

        case 'circle':
          if (currentPoints.length === 0) {
            // Center point
            setCurrentPoints([snappedPoint]);
          } else if (currentPoints.length === 1) {
            // Radius point - complete circle
            const center = currentPoints[0];
            const radius = Math.sqrt(
              Math.pow(snappedPoint.x - center.x, 2) +
                Math.pow(snappedPoint.y - center.y, 2)
            );
            const newCircle: SketchElement = {
              type: 'circle',
              id: crypto.randomUUID(),
              center,
              radius,
            };
            onElementsChange([...elements, newCircle]);
            setCurrentPoints([]);
            setPreviewElement(null);
          }
          break;

        case 'polygon':
          // Add point to polygon
          const newPoints = [...currentPoints, snappedPoint];
          setCurrentPoints(newPoints);
          break;

        case 'arc':
          if (currentPoints.length < 2) {
            setCurrentPoints([...currentPoints, snappedPoint]);
          } else if (currentPoints.length === 2) {
            // Three points - complete arc
            const newArc: SketchElement = {
              type: 'arc',
              id: crypto.randomUUID(),
              points: [currentPoints[0], currentPoints[1], snappedPoint],
            };
            onElementsChange([...elements, newArc]);
            setCurrentPoints([]);
            setPreviewElement(null);
          }
          break;

        default:
          console.warn(`Tool ${activeTool} not yet implemented`);
      }
    },
    [activeTool, currentPoints, elements, onElementsChange, snapPoint]
  );

  // Handle mouse move for preview
  const handleCanvasMove = useCallback(
    (point: Point2D) => {
      if (currentPoints.length === 0 || !activeTool) {
        setPreviewElement(null);
        return;
      }

      const snappedPoint = snapPoint(point);

      switch (activeTool) {
        case 'line':
          if (currentPoints.length === 1) {
            setPreviewElement({
              type: 'line',
              id: 'preview',
              start: currentPoints[0],
              end: snappedPoint,
            } as SketchElement);
          }
          break;

        case 'rectangle':
          if (currentPoints.length === 1) {
            setPreviewElement({
              type: 'rectangle',
              id: 'preview',
              corner1: currentPoints[0],
              corner2: snappedPoint,
            } as SketchElement);
          }
          break;

        case 'circle':
          if (currentPoints.length === 1) {
            const center = currentPoints[0];
            const radius = Math.sqrt(
              Math.pow(snappedPoint.x - center.x, 2) +
                Math.pow(snappedPoint.y - center.y, 2)
            );
            setPreviewElement({
              type: 'circle',
              id: 'preview',
              center,
              radius,
            } as SketchElement);
          }
          break;
      }
    },
    [activeTool, currentPoints, snapPoint]
  );

  // Complete polygon (for polygon tool)
  const handleCompletePolygon = useCallback(() => {
    if (activeTool === 'polygon' && currentPoints.length >= 3) {
      const newPolygon: SketchElement = {
        type: 'polygon',
        id: crypto.randomUUID(),
        points: currentPoints,
      };
      onElementsChange([...elements, newPolygon]);
      setCurrentPoints([]);
      setPreviewElement(null);
    }
  }, [activeTool, currentPoints, elements, onElementsChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel current drawing
        setCurrentPoints([]);
        setPreviewElement(null);
      } else if (e.key === 'Enter') {
        // Complete polygon
        handleCompletePolygon();
      } else if (e.key === 'g' || e.key === 'G') {
        // Toggle grid snap
        setSnapToGrid((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCompletePolygon]);

  const theme = useMantineTheme();

  return (
    <Box
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        backgroundColor: theme.other.colors.cadCanvas,
      }}
    >
      {/* Three.js Canvas with orthographic view */}
      <Canvas
        orthographic
        camera={{ position: [0, 0, 100], zoom: 5 }}
        gl={{ antialias: true, alpha: false }}
      >
        <SketchScene
          elements={elements}
          previewElement={previewElement}
          currentPoints={currentPoints}
          gridSize={gridSize}
          snapToGrid={snapToGrid}
          onCanvasClick={handleCanvasClick}
          onCanvasMove={handleCanvasMove}
        />
      </Canvas>

      {/* Sketch Controls Overlay */}
      <Stack
        gap="sm"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
        }}
      >
        <Box
          style={{
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.other.colors.border}`,
            backgroundColor: `${theme.other.colors.card}cc`,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
            backdropFilter: 'blur(12px)',
            boxShadow: theme.shadows.lg,
          }}
        >
          <Text size="xs" fw={500} c={theme.other.colors.mutedForeground} mb="xs">
            Sketch Mode
          </Text>
          <Group gap="sm">
            <Button
              size="xs"
              variant="outline"
              onClick={onCancel}
              leftSection={<X size={14} weight="regular" />}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              onClick={onFinish}
              leftSection={<Check size={14} weight="regular" />}
            >
              Finish Sketch
            </Button>
          </Group>
        </Box>

        {/* Tool hints */}
        {activeTool && (
          <Box
            style={{
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.other.colors.border}`,
              backgroundColor: `${theme.other.colors.card}cc`,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              backdropFilter: 'blur(12px)',
              boxShadow: theme.shadows.lg,
            }}
          >
            <Text size="xs" fw={500} c={theme.other.colors.mutedForeground} mb={4}>
              {getToolHint(activeTool, currentPoints.length)}
            </Text>
            <Text size="10px" c={`${theme.other.colors.mutedForeground}99`}>
              Press <Kbd size="xs">ESC</Kbd> to cancel
            </Text>
            {activeTool === 'polygon' && currentPoints.length >= 3 && (
              <Text size="10px" c={`${theme.other.colors.mutedForeground}99`} mt={4}>
                Press <Kbd size="xs">ENTER</Kbd> to complete
              </Text>
            )}
          </Box>
        )}

        {/* Grid snap indicator */}
        <Box
          style={{
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.other.colors.border}`,
            backgroundColor: `${theme.other.colors.card}cc`,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            backdropFilter: 'blur(12px)',
            boxShadow: theme.shadows.lg,
          }}
        >
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setSnapToGrid(!snapToGrid)}
            style={{
              padding: 0,
              height: 'auto',
              fontWeight: 500,
              fontSize: 12,
              color: snapToGrid ? theme.colors.blue[5] : undefined,
            }}
          >
            Grid Snap: {snapToGrid ? '✓ ON' : '✗ OFF'}
          </Button>
          <Text size="9px" c={`${theme.other.colors.mutedForeground}99`} mt={2}>
            Press <Kbd size="xs">G</Kbd> to toggle
          </Text>
        </Box>
      </Stack>

      {/* Element count */}
      <Box
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
          borderRadius: theme.radius.lg,
          border: `1px solid ${theme.other.colors.border}`,
          backgroundColor: `${theme.other.colors.card}99`,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 6,
          paddingBottom: 6,
          backdropFilter: 'blur(12px)',
          boxShadow: theme.shadows.lg,
        }}
      >
        <Text size="xs" fw={500} c={theme.other.colors.mutedForeground}>
          Elements: {elements.length}
        </Text>
      </Box>
    </Box>
  );
}

/** Three.js scene for sketch rendering */
function SketchScene({
  elements,
  previewElement,
  currentPoints,
  gridSize,
  snapToGrid,
  onCanvasClick,
  onCanvasMove,
}: {
  elements: SketchElement[];
  previewElement: SketchElement | null;
  currentPoints: Point2D[];
  gridSize: number;
  snapToGrid: boolean;
  onCanvasClick: (point: Point2D) => void;
  onCanvasMove: (point: Point2D) => void;
}) {
  const { camera, size } = useThree();
  const planeRef = useRef<THREE.Mesh>(null);

  // Handle click on sketch plane
  const handlePointerDown = useCallback(
    (e: any) => {
      e.stopPropagation();
      const point = e.point;
      onCanvasClick({ x: point.x, y: point.y });
    },
    [onCanvasClick]
  );

  // Handle mouse move
  const handlePointerMove = useCallback(
    (e: any) => {
      const point = e.point;
      onCanvasMove({ x: point.x, y: point.y });
    },
    [onCanvasMove]
  );

  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[0, 0, 10]} intensity={0.5} />

      {/* Grid */}
      <gridHelper
        args={[200, 200 / gridSize, '#444466', '#2a2a3a']}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -1]}
      />

      {/* Interactive plane */}
      <mesh
        ref={planeRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Render existing elements */}
      {elements.map((element) => (
        <SketchElementRenderer key={element.id} element={element} color="#7c93c3" />
      ))}

      {/* Render preview element */}
      {previewElement && (
        <SketchElementRenderer element={previewElement} color="#fbbf24" opacity={0.6} />
      )}

      {/* Render current points */}
      {currentPoints.map((point, index) => (
        <mesh key={index} position={[point.x, point.y, 0]}>
          <circleGeometry args={[0.5, 16]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      ))}
    </>
  );
}

/** Renders a single sketch element in Three.js */
function SketchElementRenderer({
  element,
  color,
  opacity = 1,
}: {
  element: SketchElement;
  color: string;
  opacity?: number;
}) {
  const points: THREE.Vector3[] = [];

  switch (element.type) {
    case 'line':
      points.push(
        new THREE.Vector3(element.start.x, element.start.y, 0),
        new THREE.Vector3(element.end.x, element.end.y, 0)
      );
      break;

    case 'rectangle': {
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

    case 'circle': {
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

    case 'polygon':
      element.points.forEach((p) => {
        points.push(new THREE.Vector3(p.x, p.y, 0));
      });
      // Close the polygon
      if (element.points.length > 0) {
        const first = element.points[0];
        points.push(new THREE.Vector3(first.x, first.y, 0));
      }
      break;

    // TODO: Implement arc, ellipse, spline, bezier rendering
  }

  if (points.length === 0) return null;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} opacity={opacity} transparent linewidth={2} />
    </line>
  );
}

/** Get helpful hint text for current tool state */
function getToolHint(tool: SketchTool, pointCount: number): string {
  switch (tool) {
    case 'line':
      return pointCount === 0 ? 'Click to set start point' : 'Click to set end point';
    case 'rectangle':
      return pointCount === 0 ? 'Click for first corner' : 'Click for opposite corner';
    case 'circle':
      return pointCount === 0 ? 'Click for center point' : 'Click to set radius';
    case 'polygon':
      return pointCount < 3
        ? `Click to add point (${pointCount}/3 minimum)`
        : `Click to add point or press ENTER to finish (${pointCount} points)`;
    case 'arc':
      return pointCount === 0
        ? 'Click for start point'
        : pointCount === 1
        ? 'Click for middle point'
        : 'Click for end point';
    default:
      return 'Click to place geometry';
  }
}
