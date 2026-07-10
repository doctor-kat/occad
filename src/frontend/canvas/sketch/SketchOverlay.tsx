import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Dot, DotsThree } from '@phosphor-icons/react';
import * as THREE from 'three';
import type { Sketch, SketchElement, Point2D, ConstraintInput } from '@/cad/types';
import { SketchOperation, SketchElementType } from '@/cad/types';
import { getWorkplaneTransform } from './getPlaneTransform';
import { expandSelection } from '@/cad/engine/sketch/sketchGroups';
import { getDistanceToElement } from '@/cad/engine/sketch/elementHitTest';
import { drawToolRegistry } from '@/cad/engine/sketch/drawTools/registry';
import { SketchElementRenderer3D } from './SketchElementRenderer3D';
import { SketchHotkeys } from './SketchHotkeys';
import { useViewportStore, isMultiSelectClick } from '@/frontend/shared/viewportStore';
import { constraintIconPlacements } from '@/cad/engine/sketch/constraintAnchors';
import { ORIGIN_POINT_ID } from '@/cad/engine/sketch/originPoint';
import { NO_RAYCAST, CONSTRAINT_ICONS } from './sketchOverlayConstants';
import { useSketchSnapping } from './hooks/useSketchSnapping';
import { useDimensionTool } from './hooks/useDimensionTool';
import { useSketchBoxSelection } from './hooks/useSketchBoxSelection';
import { useSketchKeyboardActions } from './hooks/useSketchKeyboardActions';

export interface SketchOverlayProps {
  sketch: Sketch;
  activeOperation: SketchOperation | null;
  activeConstraint?: string;
  onElementsChange: (sketchId: string, elements: SketchElement[]) => void;
  onBackgroundClick?: () => void;
  /** Exit sketch editing (Esc when no draw is in progress). */
  onExitSketch?: () => void;
  /** Called when the Dimension tool completes a 2-point pick. */
  onCreateConstraint?: (input: ConstraintInput) => void;
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
  onExitSketch,
  onCreateConstraint,
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
  const {
    pendingDimTarget,
    pendingDimTargetRef,
    setPendingDimTarget,
    hoveredDimTargetId,
    setHoveredDimTargetId,
    handleDimensionPick,
    resetDimensionState,
  } = useDimensionTool(sketch, onCreateConstraint);
  const [previewElement, setPreviewElement] = useState<SketchElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null);
  // Sketch element selection + hover live in the shared viewport store so the
  // constraint toolbar and the sidebar entity list (both rendered outside the R3F
  // canvas) can read and drive them.
  const selectedSketchElementIds = useViewportStore((s) => s.selectedSketchElementIds);
  const hoveredElementId = useViewportStore((s) => s.hoveredSketchElementId);
  const setHoveredElementId = useViewportStore((s) => s.setHoveredSketchElementId);
  const setSketchElementSelection = useViewportStore((s) => s.setSketchElementSelection);
  const clearSketchSelection = useViewportStore((s) => s.clearSketchSelection);
  const setSketchSelectionBox = useViewportStore((s) => s.setSketchSelectionBox);
  const selectedConstraintId = useViewportStore((s) => s.selectedConstraintId);
  const hoveredConstraintId = useViewportStore((s) => s.hoveredConstraintId);
  const setHoveredConstraintId = useViewportStore((s) => s.setHoveredConstraintId);
  const setSelectedConstraintId = useViewportStore((s) => s.setSelectedConstraintId);
  const selectedElementIds = useMemo(() => new Set(selectedSketchElementIds), [selectedSketchElementIds]);
  // Plain click selects only this entity (replaces the current selection);
  // Shift/Ctrl/Cmd-click toggles it into/out of a multi-selection (for constraints).
  const selectOrToggle = useCallback(
    (id: string, e: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
      // A grouped element selects/deselects as a whole unit (all siblings together).
      const unit = expandSelection(sketch.elements, id);
      if (isMultiSelectClick(e)) {
        const current = new Set(selectedRef.current);
        const alreadyIn = unit.every((u) => current.has(u));
        unit.forEach((u) => (alreadyIn ? current.delete(u) : current.add(u)));
        setSketchElementSelection(Array.from(current));
      } else {
        setSketchElementSelection(unit);
      }
    },
    [sketch.elements, setSketchElementSelection]
  );
  // Badge placement for each constraint: a tiny square just above the constrained
  // entity's midpoint. Clicking a badge selects that constraint.
  const constraintIcons = useMemo(
    () => constraintIconPlacements(sketch.constraints || [], sketch.elements),
    [sketch.constraints, sketch.elements]
  );
  const planeRef = useRef<THREE.Mesh>(null);

  const hoverThreshold = 3; // Distance threshold for element hover detection

  // Calculate plane transformation
  const planeTransform = useMemo(() => getWorkplaneTransform(sketch.workplane), [sketch.workplane]);

  const {
    gridSize,
    snapDistance,
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
  } = useSketchSnapping(sketch, activeConstraint);

  const suppressClickRef = useSketchBoxSelection(
    sketch.elements,
    activeOperation,
    selectedSketchElementIds,
    planeTransform,
    setSketchSelectionBox,
    setSketchElementSelection
  );

  // Clear selection when switching INTO a drawing tool (selection is only meaningful in
  // selection mode). Guarding on activeOperation avoids wiping a deliberate selection on
  // incidental remounts (e.g. a rebuild) while in selection mode.
  useEffect(() => {
    if (activeOperation) {
      clearSketchSelection();
      setHoveredElementId(null);
    }
    if (activeOperation !== SketchOperation.DIMENSION) {
      resetDimensionState();
      setHoverPoint(null);
      resetSnapIndicators();
    }
  }, [activeOperation, clearSketchSelection, resetDimensionState, resetSnapIndicators, setHoveredElementId]);

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

  useSketchKeyboardActions({
    selectedElementIds,
    sketch,
    onElementsChange,
    onCompletePolygon: handleCompletePolygon,
    clearSketchSelection,
    setSketchElementSelection,
    setHoveredElementId,
    onExitSketch,
    pendingDimTargetRef,
    setPendingDimTarget,
    currentPointsRef,
    setPoints,
    setPreviewElement,
    setSnapToGrid,
    setShowGrid,
  });

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
        // A box drag just completed — its pointer-up already set the selection, so
        // skip the single-pick toggle this trailing click would otherwise do.
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        // Single-pick: toggle the nearest element within the hover threshold
        // (multi-select for constraints). Recomputed here rather than read from
        // hover state so this handler stays referentially stable.
        let nearestId: string | null = null;
        let minDistance = hoverThreshold;
        for (const el of sketch.elements) {
          const d = getDistanceToElement(point2D, el);
          if (d < minDistance) {
            minDistance = d;
            nearestId = el.id;
          }
        }
        if (nearestId) {
          selectOrToggle(nearestId, event);
        } else {
          // Clear selection on empty click
          clearSketchSelection();
        }
        return;
      }

      // Dimension mode: points are picked via their handle mesh onClick (which
      // stopPropagation's before reaching here); this only handles clicking a
      // line, since no dedicated line-handle mesh exists.
      if (activeOperation === SketchOperation.DIMENSION) {
        let nearestLineId: string | null = null;
        let minDistance = hoverThreshold;
        for (const el of sketch.elements) {
          if (el.type !== SketchElementType.LINE) continue;
          const d = getDistanceToElement(point2D, el);
          if (d < minDistance) {
            minDistance = d;
            nearestLineId = el.id;
          }
        }
        if (nearestLineId) handleDimensionPick(nearestLineId, 'line');
        return;
      }

      const snappedPoint = snapPoint(point2D);
      // Read the in-progress points from the ref, never the closure, so this
      // handler stays referentially stable (see currentPointsRef).
      const points = currentPointsRef.current;

      const tool = drawToolRegistry[activeOperation];
      if (!tool) {
        console.warn(`Operation ${activeOperation} not yet implemented`);
        return;
      }
      const result = tool.onClick({ points, snappedPoint, sketchElements: sketch.elements });
      if (result.kind === 'continue') {
        setPoints(result.points);
      } else {
        onElementsChange(sketch.id, [...sketch.elements, ...result.elements]);
        setPoints([]);
        setPreviewElement(null);
      }
    },
    [activeOperation, sketch, onElementsChange, snapPoint, planeTransform, selectOrToggle, clearSketchSelection, setPoints, handleDimensionPick, suppressClickRef]
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

      // Dimension mode: highlight the nearest pickable entity (point primitive,
      // else line) instead of grid/origin snapping — nothing can be placed here.
      if (activeOperation === SketchOperation.DIMENSION) {
        setPreviewElement(null);
        setHoverPoint(null);
        setSnapPoint2D(null);
        setOriginSnap(false);

        let nearestId: string | null = null;
        let minDistance = snapDistance;
        for (const p of sketch.primitives || []) {
          if (p.type !== 'point' || p.isExternal || !p.data || typeof p.data.x !== 'number') continue;
          const d = Math.hypot(p.data.x - point2D.x, p.data.y - point2D.y);
          if (d < minDistance) {
            minDistance = d;
            nearestId = p.id;
          }
        }
        const dOrigin = Math.hypot(point2D.x, point2D.y);
        if (dOrigin < minDistance) nearestId = ORIGIN_POINT_ID;

        if (!nearestId) {
          let lineMinDistance = hoverThreshold;
          for (const el of sketch.elements) {
            if (el.type !== SketchElementType.LINE) continue;
            const d = getDistanceToElement(point2D, el);
            if (d < lineMinDistance) {
              lineMinDistance = d;
              nearestId = el.id;
            }
          }
        }
        setHoveredDimTargetId(nearestId);
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

      const tool = drawToolRegistry[activeOperation];
      setPreviewElement(tool ? tool.onPreview({ points, snappedPoint, sketchElements: sketch.elements }) : null);
    },
    [activeOperation, snapPoint, planeTransform, hoverThreshold, snapDistance, sketch.elements, sketch.primitives, setHoveredElementId, setHoveredDimTargetId, setOriginSnap, setSnapPoint2D]
  );

  const originSelected = selectedElementIds.has(ORIGIN_POINT_ID);
  const originHoverTarget = (pendingDimTarget?.kind === 'point' && pendingDimTarget.id === ORIGIN_POINT_ID)
    || (activeOperation === SketchOperation.DIMENSION && hoveredDimTargetId === ORIGIN_POINT_ID);
  const originHighlighted = originSelected || originHoverTarget;

  return (
    <group matrix={planeTransform} matrixAutoUpdate={false}>
      {/* Hotkeys panel */}
      <SketchHotkeys
        activeOperation={activeOperation}
        currentPointsCount={currentPoints.length}
        snapToGrid={snapToGrid}
        showGrid={showGrid}
      />

      {/* Semi-transparent sketch plane */}
      <mesh
        ref={planeRef}
        position={[0, 0, 0.01]}
        onClick={handlePlaneClick}
        onPointerMove={handlePlaneMove}
        onPointerLeave={() => {
          setHoverPoint(null);
          setOriginSnap(false);
        }}
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

      {/* Grid on sketch plane (visibility toggled with 'H', independent of snap) */}
      {showGrid && (
        <gridHelper
          args={[200, 200 / gridSize, '#6366f1', '#444466']}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, 0.01]}
          raycast={NO_RAYCAST}
        />
      )}

      {/* Origin crosshair — red X, green Y */}
      <line geometry={xAxisGeo} position={[0, 0, 0.02]} renderOrder={1000} raycast={NO_RAYCAST}>
        <lineBasicMaterial color="#ef4444" transparent opacity={0.35} depthTest={false} />
      </line>
      <line geometry={yAxisGeo} position={[0, 0, 0.02]} renderOrder={1000} raycast={NO_RAYCAST}>
        <lineBasicMaterial color="#22c55e" transparent opacity={0.35} depthTest={false} />
      </line>
      {/* Origin point — a fixed sketch entity at (0,0), mirroring the world Origin.
          Selectable in selection mode (so it can be picked for a constraint); the
          underlying fixed point primitive lives in sketch.primitives (originPoint.ts). */}
      <mesh
        position={[0, 0, 0.03]}
        renderOrder={1001}
        raycast={activeOperation && activeOperation !== SketchOperation.DIMENSION ? NO_RAYCAST : undefined}
        onClick={
          activeOperation && activeOperation !== SketchOperation.DIMENSION
            ? undefined
            : (e) => {
                e.stopPropagation();
                if (activeOperation === SketchOperation.DIMENSION) {
                  handleDimensionPick(ORIGIN_POINT_ID, 'point');
                } else {
                  selectOrToggle(ORIGIN_POINT_ID, e);
                }
              }
        }
      >
        <circleGeometry args={[originHighlighted ? 2 : 1.5, 24]} />
        <meshBasicMaterial
          color={originSelected ? '#3b82f6' : originHoverTarget ? '#f97316' : '#ffffff'}
          transparent
          opacity={originHighlighted ? 0.95 : 0.6}
          depthTest={false}
        />
      </mesh>

      {/* Render existing sketch elements */}
      {sketch.elements.map((element) => {
        // Grouped elements highlight as one unit: hovering any sibling (or the group's
        // folder row in the sidebar) highlights the whole group.
        const hoveredGroupId = hoveredElementId
          ? sketch.elements.find((e) => e.id === hoveredElementId)?.groupId
          : undefined;
        const isHovered = hoveredElementId === element.id
          || (Boolean(element.groupId) && element.groupId === hoveredGroupId)
          || (activeOperation === SketchOperation.DIMENSION && hoveredDimTargetId === element.id);
        const isSelected = selectedElementIds.has(element.id)
          || (activeOperation === SketchOperation.DIMENSION && pendingDimTarget?.kind === 'line' && pendingDimTarget.id === element.id);
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
      {(!activeOperation || activeOperation === SketchOperation.DIMENSION) && sketch.primitives
        ?.flatMap((p) => {
          if (!(p.type === 'point' && !p.isExternal && p.data && typeof p.data.x === 'number')) return [];
          const isSelected = selectedElementIds.has(p.id);
          const isHoverTarget = (pendingDimTarget?.kind === 'point' && pendingDimTarget.id === p.id)
            || (activeOperation === SketchOperation.DIMENSION && hoveredDimTargetId === p.id);
          const isSel = isSelected || isHoverTarget;
          const color = isSelected ? '#3b82f6' : isHoverTarget ? '#f97316' : '#94a3b8';
          return [
            <mesh
              key={`handle-${p.id}`}
              position={[p.data.x, p.data.y, 0.2]}
              renderOrder={1002}
              onClick={(e) => {
                e.stopPropagation();
                if (activeOperation === SketchOperation.DIMENSION) {
                  handleDimensionPick(p.id, 'point');
                } else {
                  selectOrToggle(p.id, e);
                }
              }}
            >
              <circleGeometry args={[isSel ? 1.6 : 1.1, 20]} />
              <meshBasicMaterial color={color} transparent opacity={isSel ? 0.95 : 0.6} depthTest={false} />
            </mesh>,
          ];
        })}

      {/* Constraint badges: a small labelled square just above each constrained
          entity's midpoint, drawn as a crisp DOM overlay (screen-constant size, so
          it's readable at any zoom). Clicking one selects (toggles) that
          constraint. Selection mode only, so they don't interfere with drawing. */}
      {!activeOperation && constraintIcons.map((icon) => {
        const isSel = selectedConstraintId === icon.id;
        const isHovered = hoveredConstraintId === icon.id;
        const Icon = CONSTRAINT_ICONS[icon.type] ?? DotsThree;
        return (
          <Html
            key={`constraint-${icon.id}`}
            position={[icon.x, icon.y, 0.25]}
            center
            zIndexRange={[30, 10]}
            style={{ pointerEvents: 'auto' }}
          >
            <button
              type="button"
              data-testid={`constraint-badge-${icon.id}`}
              data-hovered={isHovered}
              title={icon.type}
              aria-label={icon.type}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedConstraintId(isSel ? null : icon.id);
              }}
              onMouseEnter={() => setHoveredConstraintId(icon.id)}
              onMouseLeave={() => setHoveredConstraintId(null)}
              style={{
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isSel ? '#3b82f6' : isHovered ? '#f97316' : '#22d3ee',
                border: `1.5px solid ${isSel ? '#60a5fa' : isHovered ? '#fdba74' : '#0e7490'}`,
                borderRadius: 4,
                boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
                cursor: 'pointer',
                userSelect: 'none',
                padding: 0,
              }}
            >
              <Icon size={12} color="#0a0a0f" />
            </button>
          </Html>
        );
      })}

      {/* Render preview element */}
      {previewElement && (
        <SketchElementRenderer3D element={previewElement} color="#fbbf24" opacity={0.7} lineWidth={2} />
      )}

      {/* Render current construction points */}
      {currentPoints.map((point) => (
        <mesh key={`${point.x},${point.y}`} position={[point.x, point.y, 0.1]} raycast={NO_RAYCAST}>
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

      {/* Coincident-to-origin preview: while drawing and snapped to the origin, show
          the coincident constraint icon that WILL be added, using the hover accent
          colour as its background so it reads as a pending relation. */}
      {originSnap && activeOperation && (
        <Html
          position={[0, 0, 0.3]}
          center
          zIndexRange={[40, 20]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            data-testid="origin-coincident-preview"
            title="Coincident with origin"
            style={{
              width: 18,
              height: 18,
              transform: 'translate(12px, -12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f97316',
              border: '1.5px solid #fdba74',
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
              userSelect: 'none',
            }}
          >
            <Dot size={14} weight="bold" color="#0a0a0f" />
          </div>
        </Html>
      )}

      {/* Render available snap points based on active constraint */}
      {activeConstraint === 'point' && snapPoints.map((point) => (
        <mesh key={`snap-${point.x},${point.y}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <circleGeometry args={[0.6, 8]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
        </mesh>
      ))}

      {activeConstraint === 'midpoint' && edgeMidpoints.map((point) => (
        <mesh key={`midpoint-${point.x},${point.y}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <boxGeometry args={[1.2, 1.2, 0.1]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} />
        </mesh>
      ))}

      {activeConstraint === 'center' && circleCenters.map((point) => (
        <mesh key={`center-${point.x},${point.y}`} position={[point.x, point.y, 0.12]} raycast={NO_RAYCAST}>
          <ringGeometry args={[0.8, 1.2, 16]} />
          <meshBasicMaterial color="#ec4899" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Highlight edges when edge constraint is active */}
      {activeConstraint === 'edge' && sketch.elements.map((element) => {
        if (element.type === SketchElementType.LINE) {
          return (
            <SketchElementRenderer3D
              key={`edge-highlight-${element.id}`}
              element={element}
              color="#f97316"
              opacity={0.5}
              lineWidth={3}
            />
          );
        } else if (element.type === SketchElementType.RECTANGLE) {
          return (
            <SketchElementRenderer3D
              key={`edge-highlight-${element.id}`}
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
