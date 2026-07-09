import { useRef, useMemo, useCallback, useState, useEffect, type ComponentType } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Dot, DotsThree } from '@phosphor-icons/react';
import {
  HorizontalIcon,
  VerticalIcon,
  ParallelIcon,
  PerpendicularIcon,
  EqualIcon,
  AngularIcon,
  CoincidentIcon,
  SmartLinearIcon,
  RadiusIcon,
  TangentIcon,
  type CadIconProps,
} from '@/frontend/shared/icons';
import * as THREE from 'three';
import type { Sketch, SketchElement, Point2D, ConstraintInput } from '@/cad/types';
import { SketchOperation, SketchElementType } from '@/cad/types';
import { getWorkplaneTransform } from './getPlaneTransform';
import {
  buildMidpointLine,
  buildCenterRectangle,
  centerRectangleGuides,
  buildThreePointCornerRectangle,
  buildThreePointCenterRectangle,
  buildParallelogram,
} from '@/cad/engine/sketch/sketchShapeBuilders';
import { expandSelection } from '@/cad/engine/sketch/sketchGroups';
import {
  circleFromThreePoints,
  centerpointArc,
  tangentArc,
  endTangentDirection,
  type ArcGeometry,
} from '@/cad/engine/sketch/arcGeometry';
import { SketchElementRenderer3D } from './SketchElementRenderer3D';
import { SketchHotkeys } from './SketchHotkeys';
import { useViewportStore, isMultiSelectClick } from '@/frontend/shared/viewportStore';
import {
  boxMode,
  rectFromCorners,
  selectElementsInBox,
} from '@/cad/engine/sketch/sketchBoxSelection';
import { constraintIconPlacements } from '@/cad/engine/sketch/constraintAnchors';
import { hitsDimensionHandle } from '@/cad/engine/sketch/dimensionHandleHitTest';
import { ORIGIN_POINT_ID } from '@/cad/engine/sketch/originPoint';

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

/**
 * Icon shown inside a constraint badge, keyed by planegcs constraint type —
 * mirrors the icons used to *create* each constraint in `SketchConstraintToolbar`.
 */
const CONSTRAINT_ICONS: Record<string, ComponentType<CadIconProps>> = {
  horizontal_l: HorizontalIcon,
  vertical_l: VerticalIcon,
  parallel: ParallelIcon,
  perpendicular_ll: PerpendicularIcon,
  equal_length: EqualIcon,
  l2l_angle_ll: AngularIcon,
  p2p_coincident: CoincidentIcon,
  p2p_distance: SmartLinearIcon,
  circle_radius: RadiusIcon,
  arc_radius: RadiusIcon,
  tangent_lc: TangentIcon,
};

/** Build an ARC sketch element from solved arc geometry (center + angle sweep). */
function arcElementFrom(g: ArcGeometry): SketchElement {
  return {
    type: SketchElementType.ARC,
    id: crypto.randomUUID(),
    center: g.center,
    radius: g.radius,
    startAngle: g.startAngle,
    endAngle: g.endAngle,
  };
}

/**
 * Tangent direction at the end of the most recently drawn (non-construction)
 * element — the Tangent Arc tool continues from it. Falls back to +X when the
 * sketch is empty.
 */
function lastEndTangent(elements: SketchElement[]): Point2D {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === SketchElementType.LINE && el.construction) continue;
    const dir = endTangentDirection(el as unknown as { type: string } & Record<string, any>);
    if (dir) return dir;
  }
  return { x: 1, y: 0 };
}

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
    case SketchElementType.POINT:
      return Math.sqrt(Math.pow(point.x - element.x, 2) + Math.pow(point.y - element.y, 2));

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
      // Center-based arc (centerpoint/tangent): distance to the arc's circle.
      if (element.center && typeof element.radius === 'number') {
        const distToCenter = Math.sqrt(
          Math.pow(point.x - element.center.x, 2) + Math.pow(point.y - element.center.y, 2)
        );
        return Math.abs(distToCenter - element.radius);
      }
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
  // Dimension tool: the first entity (point primitive or line element) picked,
  // waiting for a second pick to complete the pair. Mirrored into a ref for the
  // same reason as currentPointsRef — the point-handle onClick callbacks must
  // stay stable across the first/second click.
  type DimTarget = { id: string; kind: 'point' | 'line' };
  const [pendingDimTarget, setPendingDimTargetState] = useState<DimTarget | null>(null);
  const pendingDimTargetRef = useRef<DimTarget | null>(null);
  const setPendingDimTarget = useCallback((target: DimTarget | null) => {
    pendingDimTargetRef.current = target;
    setPendingDimTargetState(target);
  }, []);
  // Entity (point primitive or line element id) currently under the cursor while
  // in Dimension mode — drives hover highlighting in place of grid/origin snapping.
  const [hoveredDimTargetId, setHoveredDimTargetId] = useState<string | null>(null);
  const [previewElement, setPreviewElement] = useState<SketchElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null);
  const [snapPoint2D, setSnapPoint2D] = useState<Point2D | null>(null);
  // True while the cursor is snapped to the origin during a draw — drives the
  // "coincident-to-be-added" preview badge shown at the origin.
  const [originSnap, setOriginSnap] = useState(false);
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
  const [snapToGrid, setSnapToGrid] = useState(true);
  // Grid *visibility* — independent of snapping (you can snap to a hidden grid,
  // or show the grid without snapping). Toggled with 'H'.
  const [showGrid, setShowGrid] = useState(true);
  const planeRef = useRef<THREE.Mesh>(null);

  // R3F context for box-select: project plane points to screen px via the live
  // camera, and attach the rubber-band drag listeners to the canvas element.
  const { camera, gl, size, scene } = useThree();

  // Mutable mirrors read by the gl.domElement listeners (registered once). Reading
  // these from refs keeps the listener effect from re-binding on every elements/
  // camera/size change mid-drag.
  const cameraRef = useRef(camera);
  const sizeRef = useRef(size);
  const sceneRef = useRef(scene);
  const elementsRef = useRef(sketch.elements);
  const planeTransformRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const activeOperationRef = useRef(activeOperation);
  const selectedRef = useRef(selectedSketchElementIds);
  // Set true the moment a box drag passes the movement threshold, so the plane's
  // onClick (which still fires on pointer-up after a drag) skips its single-pick
  // toggle. The click handler resets it.
  const suppressClickRef = useRef(false);

  const gridSize = 10;
  const snapDistance = 5; // Distance threshold for snapping to points/edges
  const hoverThreshold = 3; // Distance threshold for element hover detection

  // Calculate plane transformation
  const planeTransform = useMemo(() => getWorkplaneTransform(sketch.workplane), [sketch.workplane]);

  // Keep the listener-facing mirrors current (cheap, runs every render).
  cameraRef.current = camera;
  sizeRef.current = size;
  sceneRef.current = scene;
  elementsRef.current = sketch.elements;
  planeTransformRef.current = planeTransform;
  activeOperationRef.current = activeOperation;
  selectedRef.current = selectedSketchElementIds;

  // Clear selection when switching INTO a drawing tool (selection is only meaningful in
  // selection mode). Guarding on activeOperation avoids wiping a deliberate selection on
  // incidental remounts (e.g. a rebuild) while in selection mode.
  useEffect(() => {
    if (activeOperation) {
      clearSketchSelection();
      setHoveredElementId(null);
    }
    if (activeOperation !== SketchOperation.DIMENSION) {
      setPendingDimTarget(null);
      setHoveredDimTargetId(null);
      setHoverPoint(null);
      setSnapPoint2D(null);
      setOriginSnap(false);
    }
  }, [activeOperation, clearSketchSelection, setPendingDimTarget]);

  /** Complete a Dimension-tool pick: arm the first entity, or (on the second
   *  pick) create the appropriate distance constraint between it and this one.
   *  point+point -> p2p_distance; point+line -> p2l_distance (perpendicular);
   *  line+line -> unsupported (no such planegcs primitive). */
  const handleDimensionPick = useCallback(
    (id: string, kind: 'point' | 'line') => {
      const armed = pendingDimTargetRef.current;
      if (!armed) {
        setPendingDimTarget({ id, kind });
        return;
      }
      if (armed.id === id && armed.kind === kind) return; // same target again — no-op

      if (armed.kind === 'point' && kind === 'point') {
        const p1 = sketch.primitives?.find((p) => p.id === armed.id)?.data;
        const p2 = sketch.primitives?.find((p) => p.id === id)?.data;
        if (p1 && p2) {
          onCreateConstraint?.({
            kind: 'distance',
            p1Id: armed.id,
            p2Id: id,
            distance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
          });
        }
      } else if (armed.kind === 'line' && kind === 'line') {
        console.warn('Dimension tool: line-to-line distance is not supported (no planegcs primitive).');
      } else {
        const pointId = armed.kind === 'point' ? armed.id : id;
        const lineId = armed.kind === 'line' ? armed.id : id;
        const pointData = sketch.primitives?.find((p) => p.id === pointId)?.data;
        const linePrim = sketch.primitives?.find((p) => p.id === lineId && p.type === 'line');
        const lineStart = linePrim ? sketch.primitives?.find((p) => p.id === linePrim.data.p1_id)?.data : undefined;
        const lineEnd = linePrim ? sketch.primitives?.find((p) => p.id === linePrim.data.p2_id)?.data : undefined;
        if (pointData && lineStart && lineEnd) {
          const { distance } = projectPointOntoLineSegment(pointData, lineStart, lineEnd);
          onCreateConstraint?.({ kind: 'point-line-distance', pointId, lineId, distance });
        }
      }
      setPendingDimTarget(null);
    },
    [sketch.primitives, onCreateConstraint, setPendingDimTarget]
  );

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
      // Select all sketch entities (Ctrl/Cmd+A) — Del then deletes them.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setSketchElementSelection(sketch.elements.map((el) => el.id));
        return;
      }

      // Toggle grid snap
      if (e.key === 'g' || e.key === 'G') {
        setSnapToGrid((prev) => !prev);
        return;
      }

      // Toggle grid visibility (independent of snapping)
      if (e.key === 'h' || e.key === 'H') {
        setShowGrid((prev) => !prev);
        return;
      }

      // Complete polygon
      if (e.key === 'Enter') {
        handleCompletePolygon();
        return;
      }

      // Escape: abort the in-progress element if one is being drawn; otherwise
      // exit sketch mode entirely (falls back to clearing selection if the sketch
      // can't be exited for some reason).
      if (e.key === 'Escape') {
        if (pendingDimTargetRef.current) {
          setPendingDimTarget(null);
        } else if (currentPointsRef.current.length > 0) {
          setPoints([]);
          setPreviewElement(null);
        } else if (onExitSketch) {
          onExitSketch();
        } else {
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
  }, [selectedElementIds, sketch.elements, sketch.id, onElementsChange, handleCompletePolygon, clearSketchSelection, setPoints, onExitSketch, setHoveredElementId, setSketchElementSelection, setPendingDimTarget]);

  // Left-button rubber-band box / crossing selection of sketch entities — active
  // only in selection mode (no draw tool). The camera is on the middle button, so
  // the left button is free here. Listeners live on the canvas element (not the
  // R3F plane mesh) so the gesture works in raw screen px and doesn't depend on the
  // plane's move-only raycasting. Drag right → window (fully enclosed); drag left →
  // crossing (touching). See sketchBoxSelection.ts for the hit math.
  useEffect(() => {
    const dom = gl.domElement;
    const DRAG_THRESHOLD = 4; // px before a press counts as a drag, not a click

    let startX = 0, startY = 0; // canvas-local px at press
    let curX = 0, curY = 0;
    let pressed = false;
    let dragging = false;
    let additive = false; // Ctrl/Shift held → merge/toggle into the current set

    const toLocal = (e: PointerEvent) => {
      const r = dom.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // Plane point → screen px, via the live camera (matches the rubber-band space).
    const project = (p: { x: number; y: number }) => {
      const v = new THREE.Vector3(p.x, p.y, 0).applyMatrix4(planeTransformRef.current);
      v.project(cameraRef.current as THREE.Camera);
      const { width, height } = sizeRef.current;
      return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height };
    };

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;            // left button only
      if (activeOperationRef.current) return; // a draw tool owns the left button
      // A dimension label/arrowhead drag owns this gesture instead of box-select.
      // Raycast directly against tagged handle meshes rather than relying on a
      // flag set by another listener — two listeners on the same canvas element
      // (this raw one, and r3f's own dispatcher) fire in registration order, which
      // depends on component mount order (child effects run before parent ones),
      // not on which gesture logically "owns" the pointerdown.
      const p = toLocal(e);
      ndc.set((p.x / sizeRef.current.width) * 2 - 1, -(p.y / sizeRef.current.height) * 2 + 1);
      raycaster.setFromCamera(ndc, cameraRef.current as THREE.Camera);
      if (hitsDimensionHandle(raycaster, sceneRef.current)) return;
      pressed = true;
      dragging = false;
      additive = e.ctrlKey || e.metaKey || e.shiftKey;
      startX = curX = p.x;
      startY = curY = p.y;
    };

    const onMove = (e: PointerEvent) => {
      if (!pressed) return;
      const p = toLocal(e);
      curX = p.x;
      curY = p.y;
      if (!dragging && Math.hypot(curX - startX, curY - startY) > DRAG_THRESHOLD) {
        dragging = true;
        suppressClickRef.current = true; // swallow the trailing plane onClick
      }
      if (dragging) {
        setSketchSelectionBox({
          x: Math.min(startX, curX),
          y: Math.min(startY, curY),
          w: Math.abs(curX - startX),
          h: Math.abs(curY - startY),
          mode: boxMode(startX, curX),
        });
      }
    };

    const onUp = () => {
      if (!pressed) return;
      pressed = false;
      if (!dragging) return;
      dragging = false;
      const mode = boxMode(startX, curX);
      const rect = rectFromCorners(startX, startY, curX, curY);
      const hits = selectElementsInBox(elementsRef.current, rect, mode, project);
      if (additive) {
        const set = new Set(selectedRef.current);
        for (const id of hits) set.has(id) ? set.delete(id) : set.add(id);
        setSketchElementSelection(Array.from(set));
      } else {
        setSketchElementSelection(hits);
      }
      setSketchSelectionBox(null);
    };

    const onCancel = () => {
      pressed = false;
      dragging = false;
      setSketchSelectionBox(null);
    };

    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [gl, setSketchSelectionBox, setSketchElementSelection]);

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
          setOriginSnap(false);
          return constraintSnap;
        }
      }

      // Origin snapping: always available while placing a point, so drawn geometry
      // can land exactly on (0,0). A coincident-to-origin constraint is then inferred
      // for the endpoint (see originPoint.inferOriginCoincidence).
      if (Math.hypot(point.x, point.y) < snapDistance) {
        setSnapPoint2D({ x: 0, y: 0 });
        setOriginSnap(true);
        return { x: 0, y: 0 };
      }

      setSnapPoint2D(null);
      setOriginSnap(false);

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

      switch (activeOperation) {
        case SketchOperation.POINT: {
          // A point is placed on a single click.
          const newPoint: SketchElement = {
            type: SketchElementType.POINT,
            id: crypto.randomUUID(),
            x: snappedPoint.x,
            y: snappedPoint.y,
          };
          onElementsChange(sketch.id, [...sketch.elements, newPoint]);
          setPoints([]);
          setPreviewElement(null);
          break;
        }

        case SketchOperation.LINE:
        case SketchOperation.CENTERLINE:
          if (points.length === 0) {
            setPoints([snappedPoint]);
          } else if (points.length === 1) {
            const newLine: SketchElement = {
              type: SketchElementType.LINE,
              id: crypto.randomUUID(),
              start: points[0],
              end: snappedPoint,
              ...(activeOperation === SketchOperation.CENTERLINE ? { construction: true } : {}),
            };
            onElementsChange(sketch.id, [...sketch.elements, newLine]);
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.MIDPOINT_LINE:
          if (points.length === 0) {
            setPoints([snappedPoint]);
          } else if (points.length === 1) {
            const { start, end } = buildMidpointLine(points[0], snappedPoint);
            const newLine: SketchElement = {
              type: SketchElementType.LINE,
              id: crypto.randomUUID(),
              start,
              end,
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

        case SketchOperation.CENTER_RECTANGLE:
          if (points.length === 0) {
            setPoints([snappedPoint]);
          } else if (points.length === 1) {
            const { corner1, corner2 } = buildCenterRectangle(points[0], snappedPoint);
            // The rectangle, its center point, and the two construction diagonals form
            // one composite group so they select / delete / hover as a single unit.
            const groupId = crypto.randomUUID();
            const groupType = 'center-rectangle' as const;
            const newRect: SketchElement = {
              type: SketchElementType.RECTANGLE,
              id: crypto.randomUUID(),
              corner1,
              corner2,
              groupId,
              groupType,
            };
            // Add the center point and the two construction diagonals (which cross
            // at the center), mirroring SolidWorks' center-rectangle relations.
            const { diagonals, center } = centerRectangleGuides(corner1, corner2);
            const centerPoint: SketchElement = {
              type: SketchElementType.POINT,
              id: crypto.randomUUID(),
              x: center.x,
              y: center.y,
              groupId,
              groupType,
            };
            const diagLines: SketchElement[] = diagonals.map(([start, end]) => ({
              type: SketchElementType.LINE,
              id: crypto.randomUUID(),
              start,
              end,
              construction: true,
              groupId,
              groupType,
            }));
            onElementsChange(sketch.id, [...sketch.elements, newRect, centerPoint, ...diagLines]);
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.THREE_POINT_CORNER_RECTANGLE:
          if (points.length < 2) {
            setPoints([...points, snappedPoint]);
          } else {
            const newPoly: SketchElement = {
              type: SketchElementType.POLYGON,
              id: crypto.randomUUID(),
              points: buildThreePointCornerRectangle(points[0], points[1], snappedPoint),
            };
            onElementsChange(sketch.id, [...sketch.elements, newPoly]);
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.THREE_POINT_CENTER_RECTANGLE:
          if (points.length < 2) {
            setPoints([...points, snappedPoint]);
          } else {
            const newPoly: SketchElement = {
              type: SketchElementType.POLYGON,
              id: crypto.randomUUID(),
              points: buildThreePointCenterRectangle(points[0], points[1], snappedPoint),
            };
            onElementsChange(sketch.id, [...sketch.elements, newPoly]);
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.PARALLELOGRAM:
          if (points.length < 2) {
            setPoints([...points, snappedPoint]);
          } else {
            const newPoly: SketchElement = {
              type: SketchElementType.POLYGON,
              id: crypto.randomUUID(),
              points: buildParallelogram(points[0], points[1], snappedPoint),
            };
            onElementsChange(sketch.id, [...sketch.elements, newPoly]);
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

        case SketchOperation.PERIMETER_CIRCLE:
          // 3 points on the circumference define the circle.
          if (points.length < 2) {
            setPoints([...points, snappedPoint]);
          } else {
            const circle = circleFromThreePoints(points[0], points[1], snappedPoint);
            if (circle) {
              const newCircle: SketchElement = {
                type: SketchElementType.CIRCLE,
                id: crypto.randomUUID(),
                center: circle.center,
                radius: circle.radius,
              };
              onElementsChange(sketch.id, [...sketch.elements, newCircle]);
            }
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.CENTERPOINT_ARC:
          // center, then start (radius), then end.
          if (points.length < 2) {
            setPoints([...points, snappedPoint]);
          } else {
            const g = centerpointArc(points[0], points[1], snappedPoint);
            if (g) {
              onElementsChange(sketch.id, [...sketch.elements, arcElementFrom(g)]);
            }
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        case SketchOperation.TANGENT_ARC:
          // start, then end — tangent to the previously drawn entity's end direction.
          if (points.length === 0) {
            setPoints([snappedPoint]);
          } else {
            const g = tangentArc(points[0], lastEndTangent(sketch.elements), snappedPoint);
            if (g) {
              onElementsChange(sketch.id, [...sketch.elements, arcElementFrom(g)]);
            }
            setPoints([]);
            setPreviewElement(null);
          }
          break;

        default:
          console.warn(`Operation ${activeOperation} not yet implemented`);
      }
    },
    [activeOperation, sketch, onElementsChange, snapPoint, planeTransform, selectOrToggle, clearSketchSelection, setPoints, handleDimensionPick]
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

      switch (activeOperation) {
        case SketchOperation.LINE:
        case SketchOperation.CENTERLINE:
          if (points.length === 1) {
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start: points[0],
              end: snappedPoint,
              ...(activeOperation === SketchOperation.CENTERLINE ? { construction: true } : {}),
            } as SketchElement);
          }
          break;

        case SketchOperation.MIDPOINT_LINE:
          if (points.length === 1) {
            const { start, end } = buildMidpointLine(points[0], snappedPoint);
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start,
              end,
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

        case SketchOperation.CENTER_RECTANGLE:
          if (points.length === 1) {
            const { corner1, corner2 } = buildCenterRectangle(points[0], snappedPoint);
            setPreviewElement({
              type: SketchElementType.RECTANGLE,
              id: 'preview',
              corner1,
              corner2,
            } as SketchElement);
          }
          break;

        case SketchOperation.THREE_POINT_CORNER_RECTANGLE:
          // First edge previews as a line; the third click previews the full rectangle.
          if (points.length === 1) {
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start: points[0],
              end: snappedPoint,
            } as SketchElement);
          } else if (points.length === 2) {
            setPreviewElement({
              type: SketchElementType.POLYGON,
              id: 'preview',
              points: buildThreePointCornerRectangle(points[0], points[1], snappedPoint),
            } as SketchElement);
          }
          break;

        case SketchOperation.THREE_POINT_CENTER_RECTANGLE:
          if (points.length === 1) {
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start: points[0],
              end: snappedPoint,
            } as SketchElement);
          } else if (points.length === 2) {
            setPreviewElement({
              type: SketchElementType.POLYGON,
              id: 'preview',
              points: buildThreePointCenterRectangle(points[0], points[1], snappedPoint),
            } as SketchElement);
          }
          break;

        case SketchOperation.PARALLELOGRAM:
          if (points.length === 1) {
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start: points[0],
              end: snappedPoint,
            } as SketchElement);
          } else if (points.length === 2) {
            setPreviewElement({
              type: SketchElementType.POLYGON,
              id: 'preview',
              points: buildParallelogram(points[0], points[1], snappedPoint),
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

        case SketchOperation.PERIMETER_CIRCLE:
          // First two clicks preview as a chord; the third previews the full circle.
          if (points.length === 1) {
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start: points[0],
              end: snappedPoint,
            } as SketchElement);
          } else if (points.length === 2) {
            const circle = circleFromThreePoints(points[0], points[1], snappedPoint);
            if (circle) {
              setPreviewElement({
                type: SketchElementType.CIRCLE,
                id: 'preview',
                center: circle.center,
                radius: circle.radius,
              } as SketchElement);
            }
          }
          break;

        case SketchOperation.CENTERPOINT_ARC:
          // First click sets the center; the radius line previews next, then the arc.
          if (points.length === 1) {
            setPreviewElement({
              type: SketchElementType.LINE,
              id: 'preview',
              start: points[0],
              end: snappedPoint,
            } as SketchElement);
          } else if (points.length === 2) {
            const g = centerpointArc(points[0], points[1], snappedPoint);
            if (g) setPreviewElement({ ...arcElementFrom(g), id: 'preview' });
          }
          break;

        case SketchOperation.TANGENT_ARC:
          if (points.length === 1) {
            const g = tangentArc(points[0], lastEndTangent(sketch.elements), snappedPoint);
            if (g) setPreviewElement({ ...arcElementFrom(g), id: 'preview' });
          }
          break;
      }
    },
    [activeOperation, snapPoint, planeTransform, hoverThreshold, snapDistance, sketch.elements, sketch.primitives]
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
        ?.filter((p) => p.type === 'point' && !p.isExternal && p.data && typeof p.data.x === 'number')
        .map((p) => {
          const isSelected = selectedElementIds.has(p.id);
          const isHoverTarget = (pendingDimTarget?.kind === 'point' && pendingDimTarget.id === p.id)
            || (activeOperation === SketchOperation.DIMENSION && hoveredDimTargetId === p.id);
          const isSel = isSelected || isHoverTarget;
          const color = isSelected ? '#3b82f6' : isHoverTarget ? '#f97316' : '#94a3b8';
          return (
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
            </mesh>
          );
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
            <div
              data-testid={`constraint-badge-${icon.id}`}
              data-hovered={isHovered}
              title={icon.type}
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
              }}
            >
              <Icon size={12} color="#0a0a0f" />
            </div>
          </Html>
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
