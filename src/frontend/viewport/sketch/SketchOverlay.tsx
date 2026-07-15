import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Sketch, SketchElement, Point2D, ConstraintInput } from '@/cad/types';
import { SketchOperation, SketchElementType } from '@/cad/types';
import { getWorkplaneTransform } from './getPlaneTransform';
import { expandSelection } from '@/cad/sketch/interaction';
import { getDistanceToElement } from '@/cad/sketch/interaction';
import { drawToolRegistry } from '@/cad/sketch/drawTools/registry';
import { SketchHotkeys } from './SketchHotkeys';
import { useViewportStore, isMultiSelectClick } from '@/frontend/shared/viewportStore';
import { constraintIconPlacements } from '@/cad/sketch/interaction';
import { ORIGIN_POINT_ID } from '@/cad/sketch/geometry';
import { useSketchSnapping } from './hooks/useSketchSnapping';
import { useDimensionTool } from './hooks/useDimensionTool';
import { useSketchBoxSelection } from './hooks/useSketchBoxSelection';
import { useSketchKeyboardActions } from './hooks/useSketchKeyboardActions';
import { SketchPlaneAndGrid } from './components/SketchPlaneAndGrid';
import { SketchOriginGizmo } from './components/SketchOriginGizmo';
import { SketchElementsLayer } from './components/SketchElementsLayer';
import { SketchConstraintBadges } from './components/SketchConstraintBadges';
import { SketchDrawingFeedback } from './components/SketchDrawingFeedback';
import { SketchConstraintSnapHighlights } from './components/SketchConstraintSnapHighlights';

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

  const pickPoint = useCallback(
    (id: string, e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (activeOperation === SketchOperation.DIMENSION) {
        handleDimensionPick(id, 'point');
      } else {
        selectOrToggle(id, e);
      }
    },
    [activeOperation, handleDimensionPick, selectOrToggle]
  );

  return (
    <group matrix={planeTransform} matrixAutoUpdate={false}>
      {/* Hotkeys panel */}
      <SketchHotkeys
        activeOperation={activeOperation}
        currentPointsCount={currentPoints.length}
        snapToGrid={snapToGrid}
        showGrid={showGrid}
      />

      <SketchPlaneAndGrid
        planeRef={planeRef}
        onClick={handlePlaneClick}
        onPointerMove={handlePlaneMove}
        onPointerLeave={() => {
          setHoverPoint(null);
          setOriginSnap(false);
        }}
        showGrid={showGrid}
        gridSize={gridSize}
        xAxisGeo={xAxisGeo}
        yAxisGeo={yAxisGeo}
      />

      <SketchOriginGizmo
        activeOperation={activeOperation}
        originSelected={originSelected}
        originHoverTarget={originHoverTarget}
        onPick={(e) => pickPoint(ORIGIN_POINT_ID, e)}
      />

      <SketchElementsLayer
        sketch={sketch}
        activeOperation={activeOperation}
        hoveredElementId={hoveredElementId}
        hoveredDimTargetId={hoveredDimTargetId}
        selectedElementIds={selectedElementIds}
        pendingDimTarget={pendingDimTarget}
        onPickPoint={pickPoint}
      />

      {!activeOperation && (
        <SketchConstraintBadges
          constraintIcons={constraintIcons}
          selectedConstraintId={selectedConstraintId}
          hoveredConstraintId={hoveredConstraintId}
          setSelectedConstraintId={setSelectedConstraintId}
          setHoveredConstraintId={setHoveredConstraintId}
        />
      )}

      <SketchDrawingFeedback
        previewElement={previewElement}
        currentPoints={currentPoints}
        hoverPoint={hoverPoint}
        activeOperation={activeOperation}
        snapPoint2D={snapPoint2D}
        originSnap={originSnap}
      />

      <SketchConstraintSnapHighlights
        activeConstraint={activeConstraint}
        sketch={sketch}
        snapPoints={snapPoints}
        edgeMidpoints={edgeMidpoints}
        circleCenters={circleCenters}
      />
    </group>
  );
}
