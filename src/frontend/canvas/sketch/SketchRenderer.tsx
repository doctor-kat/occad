import { useCallback, useMemo, useRef, useState } from 'react';
import { Text } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sphere } from '@react-three/drei';
import { Sketch, Point2D } from '@/cad/types';
import { lift, project } from '@/cad/engine/sketch/coordinateSystem';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { pointPointDimensionLayout, pointLineDimensionLayout, axisDimensionLayout, type DimensionLayout } from '@/cad/engine/sketch/dimensionLayout';
import { DIMENSION_HANDLE_USERDATA_KEY } from '@/cad/engine/sketch/dimensionHandleHitTest';
import { NativePolyline } from './NativePolyline';

const DIMENSION_HANDLE_USERDATA = { [DIMENSION_HANDLE_USERDATA_KEY]: true };

/** planegcs uses `c_id` for a circle/arc center; unsolved data may use `center_id`. */
const centerPointId = (data: any): string | undefined => data.c_id ?? data.center_id;

const DEFAULT_LABEL_DISTANCE = 10;

/** Unit vector perpendicular to a->b, or straight up for a degenerate (zero-length)
 *  segment. Used as the default dimension-label direction so it offsets to the side
 *  of a vertical line instead of further along it (matching constraint badge placement). */
function perpUnit(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  return l === 0 ? { x: 0, y: 1 } : { x: -dy / l, y: dx / l };
}

interface SketchRendererProps {
  sketch: Sketch;
  onUpdateConstraintValue?: (constraintId: string, value: number) => void;
  onUpdateLabelOffset?: (constraintId: string, offset: Point2D) => void;
  onToggleArrowFlip?: (constraintId: string) => void;
}

/** Radius of the invisible click target centered on each arrowhead — bigger than the
 *  arrow's own glyph so it's easy to grab, but small enough not to swallow clicks
 *  meant for the dimension line or label between them. */
const ARROW_HIT_RADIUS = 1.2;

/** Draw a dimension's witness/extension lines, dimension line, arrowheads, and value label. */
function DimensionAnnotation({
  layout,
  workplane,
  color,
  isSelected,
  value,
  onDoubleClick,
  onDragStart,
  onToggleArrows,
}: {
  layout: DimensionLayout;
  workplane: Sketch['workplane'];
  color: string;
  isSelected: boolean;
  value: number;
  onDoubleClick: () => void;
  onDragStart: (e: any) => void;
  onToggleArrows: (e: any) => void;
}) {
  const to3 = (p: Point2D) => lift(p, workplane);
  const v3 = (p: Point2D): [number, number, number] => {
    const l = to3(p);
    return [l.x, l.y, l.z];
  };
  const labelPos = to3(layout.labelPos);
  const arrow1Tip = to3(layout.dimLine[0]);
  const arrow2Tip = to3(layout.dimLine[1]);
  // Selection takes priority over the driving/conflict color, matching how
  // constraint badges and point handles show selection elsewhere in the sketch.
  const lineColor = isSelected ? '#3b82f6' : color;

  return (
    <group>
      <NativePolyline points={[v3(layout.ext1[0]), v3(layout.ext1[1])]} color="#64748b" opacity={0.6} />
      <NativePolyline points={[v3(layout.ext2[0]), v3(layout.ext2[1])]} color="#64748b" opacity={0.6} />
      {/* Two segments with a gap around the label, instead of one line running
          through the value text. */}
      <NativePolyline points={[v3(layout.dimLineSegments[0][0]), v3(layout.dimLineSegments[0][1])]} color={lineColor} />
      <NativePolyline points={[v3(layout.dimLineSegments[1][0]), v3(layout.dimLineSegments[1][1])]} color={lineColor} />
      <NativePolyline points={layout.arrow1.map(v3)} color={lineColor} />
      <NativePolyline points={layout.arrow2.map(v3)} color={lineColor} />
      {/* Invisible click targets over each arrowhead — clicking either one flips
          BOTH arrows together, toggling the whole dimension between pointing
          inward (default) and outward (the standard CAD "inside"/"outside" style,
          not two independently-flippable arrows). */}
      {[{ id: 'arrow1', tip: arrow1Tip }, { id: 'arrow2', tip: arrow2Tip }].map(({ id, tip }) => (
        <mesh key={id} position={[tip.x, tip.y, tip.z + 0.05]} onClick={onToggleArrows} userData={DIMENSION_HANDLE_USERDATA}>
          <circleGeometry args={[ARROW_HIT_RADIUS, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {/* Invisible bigger hit-area behind the label so dragging/selecting is easy to grab. */}
      <mesh position={[labelPos.x, labelPos.y, labelPos.z + 0.05]} onPointerDown={onDragStart} userData={DIMENSION_HANDLE_USERDATA}>
        <planeGeometry args={[4, 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Text
        position={[labelPos.x, labelPos.y, labelPos.z + 0.1]}
        fontSize={1.5}
        color={isSelected ? '#3b82f6' : 'white'}
        anchorX="center"
        anchorY="middle"
        onDoubleClick={onDoubleClick}
        onPointerDown={onDragStart}
        userData={DIMENSION_HANDLE_USERDATA}
      >
        {value.toFixed(2)}
      </Text>
    </group>
  );
}

export function SketchRenderer({ sketch, onUpdateConstraintValue, onUpdateLabelOffset, onToggleArrowFlip }: SketchRendererProps) {
  const { workplane, primitives, constraints, visualMetadata, dof } = sketch;
  const isFullyConstrained = dof === 0;
  const defaultColor = isFullyConstrained ? "#10b981" : "#3b82f6"; // Green if full, Blue if under

  const { camera, gl } = useThree();
  const selectedConstraintId = useViewportStore((s) => s.selectedConstraintId);
  const setSelectedConstraintId = useViewportStore((s) => s.setSelectedConstraintId);
  // Live drag override, keyed by constraint id — followed the cursor at render
  // rate without touching parent state/solver until the drag is released.
  const [dragOffsets, setDragOffsets] = useState<Record<string, Point2D>>({});
  // Which dimension has crossed DRAG_THRESHOLD and is actively being repositioned —
  // set as soon as the drag "moved" flag flips, independent of whether the
  // screen-to-sketch-plane raycast that computes the actual offset succeeds, so the
  // highlight doesn't depend on that raycast (unlike `dragOffsets`, which does).
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // `moved` distinguishes a plain click (select/deselect) from an actual drag
  // (reposition the label) — mirrors the DRAG_THRESHOLD pattern used for the
  // sketch entity box-select gesture in SketchOverlay.
  const dragRef = useRef<{ constraintId: string; mid2d: Point2D; startX: number; startY: number; moved: boolean } | null>(null);
  const DRAG_THRESHOLD = 4;
  // Highlight with the selection color both when formally selected AND while a
  // drag is actively in progress — the user shouldn't have to release the pointer
  // first to see which dimension they're moving.
  const isHighlighted = (constraintId: string) => selectedConstraintId === constraintId || activeDragId === constraintId;
  // Rough sketch centroid (average of all point primitives), used only to pick
  // which side of an edge a default dimension offset should face — outward, away
  // from the rest of the sketch, rather than whichever side the perpendicular
  // rotation happens to land on (which flips depending on click order and would
  // otherwise sometimes point the label back into the shape).
  const sketchCentroid = useMemo(() => {
    const pts = primitives.filter((p) => p.type === 'point');
    if (pts.length === 0) return { x: 0, y: 0 };
    return {
      x: pts.reduce((s, p) => s + p.data.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.data.y, 0) / pts.length,
    };
  }, [primitives]);

  /** perpUnit(a, b), flipped if needed so it points away from the sketch centroid. */
  const outwardPerpUnit = (a: Point2D, b: Point2D, mid: Point2D): Point2D => {
    const perp = perpUnit(a, b);
    const outward = { x: mid.x - sketchCentroid.x, y: mid.y - sketchCentroid.y };
    if (perp.x * outward.x + perp.y * outward.y < 0) return { x: -perp.x, y: -perp.y };
    return perp;
  };

  const worldPlane = useMemo(
    () => new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z),
      new THREE.Vector3(workplane.origin.x, workplane.origin.y, workplane.origin.z),
    ),
    [workplane],
  );

  const screenToLocal2D = useCallback((clientX: number, clientY: number): Point2D | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(worldPlane, hit)) return null;
    return project({ x: hit.x, y: hit.y, z: hit.z }, workplane);
  }, [camera, gl, worldPlane, workplane]);

  const onWindowMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD) {
      drag.moved = true;
      setActiveDragId(drag.constraintId);
    }
    if (!drag.moved) return; // still just a click until the pointer actually moves
    const local = screenToLocal2D(e.clientX, e.clientY);
    if (!local) return;
    setDragOffsets((prev) => ({ ...prev, [drag.constraintId]: { x: local.x - drag.mid2d.x, y: local.y - drag.mid2d.y } }));
  }, [screenToLocal2D]);

  const onWindowUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    setActiveDragId(null);
    if (!drag) return;
    if (!drag.moved) {
      // A plain click (no drag): select/deselect this dimension, same store field
      // constraint badges use, so SketchConstraintList highlighting stays in sync.
      const current = useViewportStore.getState().selectedConstraintId;
      setSelectedConstraintId(current === drag.constraintId ? null : drag.constraintId);
      return;
    }
    setDragOffsets((prev) => {
      const offset = prev[drag.constraintId];
      if (offset) onUpdateLabelOffset?.(drag.constraintId, offset);
      const next = { ...prev };
      delete next[drag.constraintId];
      return next;
    });
  }, [onWindowMove, onUpdateLabelOffset, setSelectedConstraintId]);

  const startDrag = useCallback((constraintId: string, mid2d: Point2D) => (e: any) => {
    e.stopPropagation();
    dragRef.current = { constraintId, mid2d, startX: e.clientX, startY: e.clientY, moved: false };
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
  }, [onWindowMove, onWindowUp]);

  const labelOffsetFor = (constraintId: string, defaultDir: Point2D = { x: 0, y: 1 }): Point2D =>
    dragOffsets[constraintId]
    || visualMetadata[constraintId]?.labelOffset
    || { x: defaultDir.x * DEFAULT_LABEL_DISTANCE, y: defaultDir.y * DEFAULT_LABEL_DISTANCE };

  const arrowFlipFor = (constraintId: string) => visualMetadata[constraintId]?.arrowFlip ?? false;

  const toggleArrowFlip = useCallback((constraintId: string) => (e: any) => {
    e.stopPropagation();
    onToggleArrowFlip?.(constraintId);
  }, [onToggleArrowFlip]);

  const renderPrimitives = primitives.map((primitive) => {
    const color = primitive.isExternal ? "#4b5563" : defaultColor;

    switch (primitive.type) {
      case 'line': {
        const p1Data = primitives.find(p => p.id === primitive.data.p1_id)?.data;
        const p2Data = primitives.find(p => p.id === primitive.data.p2_id)?.data;
        if (!p1Data || !p2Data) return null;

        const start = lift({ x: p1Data.x, y: p1Data.y }, workplane);
        const end = lift({ x: p2Data.x, y: p2Data.y }, workplane);

        return (
          <NativePolyline
            key={primitive.id}
            points={[[start.x, start.y, start.z], [end.x, end.y, end.z]]}
            color={color}
            dashed={!!primitive.isExternal}
          />
        );
      }
      case 'point': {
        const pos = lift({ x: primitive.data.x, y: primitive.data.y }, workplane);
        return (
          <Sphere key={primitive.id} position={[pos.x, pos.y, pos.z]} args={[0.2, 16, 16]}>
            <meshBasicMaterial color={primitive.isExternal ? "gray" : defaultColor} />
          </Sphere>
        );
      }
      case 'circle': {
        const centerData = primitives.find(p => p.id === centerPointId(primitive.data))?.data;
        if (!centerData) return null;

        const segments = 64;
        const points: [number, number, number][] = [];
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const x = primitive.data.radius * Math.cos(angle);
          const y = primitive.data.radius * Math.sin(angle);
          const pos = lift({ x: centerData.x + x, y: centerData.y + y }, workplane);
          points.push([pos.x, pos.y, pos.z]);
        }

        return (
          <NativePolyline
            key={primitive.id}
            points={points}
            color={color}
            dashed={!!primitive.isExternal}
          />
        );
      }
      case 'arc': {
        const centerData = primitives.find(p => p.id === centerPointId(primitive.data))?.data;
        if (!centerData) return null;

        const segments = 32;
        const points: [number, number, number][] = [];
        const { start_angle, end_angle, radius } = primitive.data;

        for (let i = 0; i <= segments; i++) {
          const angle = start_angle + (i / segments) * (end_angle - start_angle);
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const pos = lift({ x: centerData.x + x, y: centerData.y + y }, workplane);
          points.push([pos.x, pos.y, pos.z]);
        }

        return (
          <NativePolyline
            key={primitive.id}
            points={points}
            color={color}
            dashed={!!primitive.isExternal}
          />
        );
      }
      default:
        return null;
    }
  });

  // Renders a dimension's shared JSX — only the layout/value/prompt-copy/mid2d differ
  // per constraint type (p2p_distance, p2l_distance, difference).
  const renderDimension = (
    constraintId: string,
    layout: DimensionLayout,
    dimColor: string,
    value: number,
    mid2d: Point2D,
    promptLabel: string,
  ) => (
    <DimensionAnnotation
      isSelected={isHighlighted(constraintId)}
      key={constraintId}
      layout={layout}
      workplane={workplane}
      color={dimColor}
      value={value}
      onDragStart={startDrag(constraintId, mid2d)}
      onToggleArrows={toggleArrowFlip(constraintId)}
      onDoubleClick={() => {
        const newValue = prompt(promptLabel, value);
        if (newValue !== null && onUpdateConstraintValue) {
          onUpdateConstraintValue(constraintId, parseFloat(newValue));
        }
      }}
    />
  );

  // Render annotations (dimensions, etc.)
  const renderAnnotations = constraints.map((constraint) => {
    const meta = visualMetadata[constraint.id];

    // Dimension color logic
    let dimColor = "#94a3b8"; // Default gray (non-driving)
    if (meta?.isDriving) dimColor = "#3b82f6"; // Blue (driving)
    if (meta?.conflictState === 'conflicting') dimColor = "#ef4444"; // Red (conflicting)

    if (constraint.type === 'p2p_distance') {
      const p1Data = primitives.find(p => p.id === constraint.p1_id)?.data;
      const p2Data = primitives.find(p => p.id === constraint.p2_id)?.data;
      if (!p1Data || !p2Data) return null;

      const mid2d = { x: (p1Data.x + p2Data.x) / 2, y: (p1Data.y + p2Data.y) / 2 };
      const offset = labelOffsetFor(constraint.id, outwardPerpUnit(p1Data, p2Data, mid2d));
      const layout = pointPointDimensionLayout(p1Data, p2Data, offset, arrowFlipFor(constraint.id));

      return renderDimension(constraint.id, layout, dimColor, constraint.distance, mid2d, "Enter distance:");
    }

    if (constraint.type === 'p2l_distance') {
      const pointData = primitives.find(p => p.id === constraint.p_id)?.data;
      const linePrim = primitives.find(p => p.id === constraint.l_id);
      const lineStart = linePrim ? primitives.find(p => p.id === linePrim.data.p1_id)?.data : undefined;
      const lineEnd = linePrim ? primitives.find(p => p.id === linePrim.data.p2_id)?.data : undefined;
      if (!pointData || !lineStart || !lineEnd) return null;

      const lineMid = { x: (lineStart.x + lineEnd.x) / 2, y: (lineStart.y + lineEnd.y) / 2 };
      const offset = labelOffsetFor(constraint.id, outwardPerpUnit(lineStart, lineEnd, lineMid));
      const layout = pointLineDimensionLayout(pointData, lineStart, lineEnd, offset, arrowFlipFor(constraint.id));
      const mid2d = { x: (layout.dimLine[0].x + layout.dimLine[1].x) / 2, y: (layout.dimLine[0].y + layout.dimLine[1].y) / 2 };

      return renderDimension(constraint.id, layout, dimColor, constraint.distance, mid2d, "Enter distance:");
    }

    if (constraint.type === 'difference') {
      const p1Data = primitives.find(p => p.id === constraint.param1?.o_id)?.data;
      const p2Data = primitives.find(p => p.id === constraint.param2?.o_id)?.data;
      if (!p1Data || !p2Data) return null;
      const axis: 'x' | 'y' = constraint.param1?.prop === 'x' ? 'x' : 'y';

      const mid2d = { x: (p1Data.x + p2Data.x) / 2, y: (p1Data.y + p2Data.y) / 2 };
      // Axis-aligned normal (up/down for a horizontal-distance dim, left/right for
      // vertical-distance), sign-corrected to face away from the sketch so the default
      // doesn't land back on top of the geometry (e.g. a bottom edge's dimension
      // should drop below it, not go "up" into the shape like a top edge's does).
      const axisNormal: Point2D = axis === 'x' ? { x: 0, y: 1 } : { x: 1, y: 0 };
      const facingIn = axisNormal.x * (mid2d.x - sketchCentroid.x) + axisNormal.y * (mid2d.y - sketchCentroid.y) < 0;
      const defaultDir = facingIn ? { x: -axisNormal.x, y: -axisNormal.y } : axisNormal;
      const offset = labelOffsetFor(constraint.id, defaultDir);
      const layout = axisDimensionLayout(p1Data, p2Data, axis, offset, arrowFlipFor(constraint.id));

      return renderDimension(constraint.id, layout, dimColor, constraint.difference, mid2d, "Enter distance:");
    }

    if (constraint.type === 'parallel' || constraint.type === 'perpendicular' || constraint.type === 'tangent') {
      const p1Id = constraint.line1_id || constraint.obj1_id;
      if (!p1Id) return null;
      const prim = primitives.find(p => p.id === p1Id);
      if (!prim) return null;

      let midpoint2d: Point2D | undefined;
      if (prim.type === 'line') {
        const p1 = primitives.find(p => p.id === prim.data.p1_id)?.data;
        const p2 = primitives.find(p => p.id === prim.data.p2_id)?.data;
        if (p1 && p2) midpoint2d = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      } else if (prim.type === 'circle' || prim.type === 'arc') {
        const center = primitives.find(p => p.id === centerPointId(prim.data))?.data;
        if (center) midpoint2d = { x: center.x, y: center.y + prim.data.radius };
      }

      if (!midpoint2d) return null;
      const pos = lift(midpoint2d, workplane);

      return (
        <Text
          key={constraint.id}
          position={[pos.x, pos.y, pos.z + 0.1]}
          fontSize={1}
          color="amber"
          anchorX="center"
          anchorY="middle"
        >
          {constraint.type === 'parallel' ? '||' : constraint.type === 'perpendicular' ? '⊥' : 'T'}
        </Text>
      );
    }
    return null;
  });

  return (
    <group>
      {renderPrimitives}
      {renderAnnotations}
    </group>
  );
}
