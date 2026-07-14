import { Text } from '@react-three/drei';
import { Sketch, Point2D } from '@/cad/types';
import { lift } from '@/cad/engine/sketch/coordinateSystem';
import { type DimensionLayout } from '@/cad/engine/sketch/dimensionLayout';
import { DIMENSION_HANDLE_USERDATA_KEY } from '@/cad/engine/sketch/dimensionHandleHitTest';
import { NativePolyline } from '../NativePolyline';

const DIMENSION_HANDLE_USERDATA = { [DIMENSION_HANDLE_USERDATA_KEY]: true };

/** Radius of the invisible click target centered on each arrowhead — bigger than the
 *  arrow's own glyph so it's easy to grab, but small enough not to swallow clicks
 *  meant for the dimension line or label between them. */
const ARROW_HIT_RADIUS = 1.2;

/** Draw a dimension's witness/extension lines, dimension line, arrowheads, and value label. */
export function DimensionAnnotation({
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
