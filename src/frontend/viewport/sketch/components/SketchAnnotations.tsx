import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { Sketch, Point2D } from '@/cad/types';
import { lift } from '@/cad/sketch/coordinateSystem';
import { pointPointDimensionLayout, pointLineDimensionLayout, axisDimensionLayout, type DimensionLayout } from '@/cad/sketch/dimensionLayout';
import { perpUnit, centerPointId } from '../dimensionGeometryUtils';
import { useDimensionDrag } from '../hooks/useDimensionDrag';
import { DimensionAnnotation } from './DimensionAnnotation';

interface SketchAnnotationsProps {
  sketch: Sketch;
  onUpdateConstraintValue?: (constraintId: string, value: number) => void;
  onUpdateLabelOffset?: (constraintId: string, offset: Point2D) => void;
  onToggleArrowFlip?: (constraintId: string) => void;
}

/** Renders dimension annotations and geometric-constraint badges for a sketch. */
export function SketchAnnotations({ sketch, onUpdateConstraintValue, onUpdateLabelOffset, onToggleArrowFlip }: SketchAnnotationsProps) {
  const { workplane, primitives, constraints, visualMetadata } = sketch;

  const { startDrag, isHighlighted, labelOffsetFor, arrowFlipFor, toggleArrowFlip } = useDimensionDrag({
    workplane,
    visualMetadata,
    onUpdateLabelOffset,
    onToggleArrowFlip,
  });

  // Rough sketch centroid (average of all point primitives), used only to pick which
  // side of an edge a default dimension offset should face — outward, away from the
  // rest of the sketch, rather than whichever side the perpendicular rotation happens
  // to land on (which flips depending on click order and would otherwise sometimes
  // point the label back into the shape).
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

  return (
    <>
      {constraints.map((constraint) => {
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
      })}
    </>
  );
}
