import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Sketch, SketchElement, Point2D, MeshData, SketchEdgeData } from '@/cad/types';
import { SketchOperation, SketchElementType } from '@/cad/types';
import { SketchElementRenderer3D } from './SketchElementRenderer3D';
import { SketchHotkeys } from './SketchHotkeys';
import { project } from '@/cad/engine/sketch/coordinateSystem';

export interface SketchOverlayProps {
  sketch: Sketch;
  activeOperation: SketchOperation | null;
  activeConstraint?: string;
  onElementsChange: (sketchId: string, elements: SketchElement[]) => void;
  onBackgroundClick?: () => void;
  occMesh?: MeshData | null;
  occSketchEdges?: Record<string, SketchEdgeData> | null;
}

export function SketchOverlay({
  sketch,
  activeOperation,
  activeConstraint = 'none',
  onElementsChange,
  onBackgroundClick,
  occMesh,
  occSketchEdges,
}: SketchOverlayProps) {
  const { viewport, camera } = useThree();
  const [currentPoints, setCurrentPoints] = useState<Point2D[]>([]);
  const [previewElement, setPreviewElement] = useState<SketchElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null);
  const [snapPoint2D, setSnapPoint2D] = useState<Point2D | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const [snapToGrid, setSnapToGrid] = useState(true);
  const planeRef = useRef<THREE.Mesh>(null);

  const gridSize = 10;
  
  // Snap threshold: 12px converted to world units
  const getSnapThreshold = useCallback(() => {
    // Basic approximation of px to world units at current zoom
    // In a real OCC setup we'd use V3d_View::Convert
    const distance = camera.position.length();
    return (12 / viewport.height) * distance;
  }, [camera.position, viewport.height]);

  const snapDistance = getSnapThreshold();

  // Create Matrix4 for plane transformation from Workplane
  const planeTransform = useMemo(() => {
    const { origin, normal, xAxis, yAxis } = sketch.workplane;
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(
      new THREE.Vector3(xAxis.x, xAxis.y, xAxis.z),
      new THREE.Vector3(yAxis.x, yAxis.y, yAxis.z),
      new THREE.Vector3(normal.x, normal.y, normal.z)
    );
    matrix.setPosition(origin.x, origin.y, origin.z);
    return matrix;
  }, [sketch.workplane]);

  // Snap logic implementation
  const findSnapPoint = useCallback((point3d: THREE.Vector3): Point2D | null => {
    const threshold = getSnapThreshold();
    
    // 1. Existing sketch primitives
    for (const prim of sketch.primitives) {
      if (prim.type === 'point') {
        const p2d = prim.data;
        const p3d = new THREE.Vector3(p2d.x, p2d.y, 0).applyMatrix4(planeTransform);
        if (point3d.distanceTo(p3d) < threshold) return p2d;
      }
    }

    // 2. OCC vertices
    if (occMesh) {
      const vertices = occMesh.faceVertices;
      for (let i = 0; i < vertices.length; i += 3) {
        const vp = new THREE.Vector3(vertices[i], vertices[i+1], vertices[i+2]);
        if (point3d.distanceTo(vp) < threshold) {
          return project({ x: vp.x, y: vp.y, z: vp.z }, sketch.workplane);
        }
      }
    }

    // 3. OCC edges
    if (occSketchEdges) {
      for (const edgeData of Object.values(occSketchEdges)) {
        const verts = edgeData.edgeVertices;
        for (let i = 0; i < verts.length; i += 3) {
          const vp = new THREE.Vector3(verts[i], verts[i+1], verts[i+2]);
          if (point3d.distanceTo(vp) < threshold) {
            return project({ x: vp.x, y: vp.y, z: vp.z }, sketch.workplane);
          }
        }
      }
    }

    return null;
  }, [sketch.primitives, sketch.workplane, planeTransform, occMesh, occSketchEdges, getSnapThreshold]);

  const handlePlaneMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const worldPoint = event.point;
    
    // Find snap point in 3D proximity
    const snapped2d = findSnapPoint(worldPoint);
    
    if (snapped2d) {
      setSnapPoint2D(snapped2d);
      setHoverPoint(snapped2d);
    } else {
      setSnapPoint2D(null);
      // Fallback to grid or raw plane projection
      const localPoint = worldPoint.clone().applyMatrix4(planeTransform.clone().invert());
      let p2d = { x: localPoint.x, y: localPoint.y };
      
      if (snapToGrid) {
        p2d = {
          x: Math.round(p2d.x / gridSize) * gridSize,
          y: Math.round(p2d.y / gridSize) * gridSize,
        };
      }
      setHoverPoint(p2d);
    }
  }, [findSnapPoint, planeTransform, snapToGrid, gridSize]);

  const handlePlaneClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!hoverPoint) return;

    const snappedPoint = hoverPoint;

    if (!activeOperation) return;

    switch (activeOperation) {
      case SketchOperation.LINE:
        if (currentPoints.length === 0) {
          setCurrentPoints([snappedPoint]);
        } else if (currentPoints.length === 1) {
          const newLine: SketchElement = {
            type: SketchElementType.LINE,
            id: crypto.randomUUID(),
            start: currentPoints[0],
            end: snappedPoint,
          };
          onElementsChange(sketch.id, [...(sketch.elements || []), newLine]);
          setCurrentPoints([]);
          setPreviewElement(null);
        }
        break;
      // ... other operations
    }
  }, [activeOperation, currentPoints, hoverPoint, sketch.id, sketch.elements, onElementsChange]);

  // Simplified render for brevity in this step, focusing on logic
  return (
    <group matrix={planeTransform} matrixAutoUpdate={false}>
      <mesh
        ref={planeRef}
        position={[0, 0, 0]}
        onClick={handlePlaneClick}
        onPointerMove={handlePlaneMove}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Grid */}
      <gridHelper args={[200, 20, '#444466', '#222244']} rotation={[Math.PI/2, 0, 0]} />

      {/* Elements */}
      {(sketch.elements || []).map(el => (
        <SketchElementRenderer3D key={el.id} element={el} color="#7c93c3" />
      ))}

      {/* Preview */}
      {hoverPoint && activeOperation && (
        <mesh position={[hoverPoint.x, hoverPoint.y, 0.05]}>
          <circleGeometry args={[0.5, 16]} />
          <meshBasicMaterial color="#60a5fa" />
        </mesh>
      )}
    </group>
  );
}
