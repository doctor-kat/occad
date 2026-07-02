import { Sphere, Text } from '@react-three/drei';
import { Sketch, Point2D } from '@/cad/types';
import { lift } from '@/cad/engine/sketch/coordinateSystem';
import { NativePolyline } from './NativePolyline';

/** planegcs uses `c_id` for a circle/arc center; unsolved data may use `center_id`. */
const centerPointId = (data: any): string | undefined => data.c_id ?? data.center_id;

interface SketchRendererProps {
  sketch: Sketch;
  onUpdateConstraintValue?: (constraintId: string, value: number) => void;
}

export function SketchRenderer({ sketch, onUpdateConstraintValue }: SketchRendererProps) {
  const { workplane, primitives, constraints, visualMetadata, dof } = sketch;
  const isFullyConstrained = dof === 0;
  const defaultColor = isFullyConstrained ? "#10b981" : "#3b82f6"; // Green if full, Blue if under

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

  // Render annotations (dimensions, etc.)
  const renderAnnotations = constraints.map((constraint) => {
    const meta = visualMetadata[constraint.id];
    
    // Dimension color logic
    let dimColor = "#94a3b8"; // Default gray (non-driving)
    if (meta?.isDriving) dimColor = "#3b82f6"; // Blue (driving)
    if (meta?.conflictState === 'conflicting') dimColor = "#ef4444"; // Red (conflicting)

    if (constraint.type === 'p2p_distance' || constraint.type === 'p2l_distance') {
      const p1Data = primitives.find(p => p.id === constraint.p1_id)?.data;
      const p2Data = primitives.find(p => p.id === constraint.p2_id)?.data;
      if (!p1Data || !p2Data) return null;

      const p1 = lift({ x: p1Data.x, y: p1Data.y }, workplane);
      const p2 = lift({ x: p2Data.x, y: p2Data.y }, workplane);
      
      const mid2d = { x: (p1Data.x + p2Data.x) / 2, y: (p1Data.y + p2Data.y) / 2 };
      const labelOffset = meta?.labelOffset || { x: 10, y: 10 };
      const labelPos = lift({ x: mid2d.x + labelOffset.x, y: mid2d.y + labelOffset.y }, workplane);

      return (
        <group key={constraint.id}>
          {/* Dimension line */}
          <NativePolyline
            points={[[p1.x, p1.y, p1.z], [labelPos.x, labelPos.y, labelPos.z], [p2.x, p2.y, p2.z]]}
            color={dimColor}
          />
          {/* Label */}
          <Text
            position={[labelPos.x, labelPos.y, labelPos.z + 0.1]}
            fontSize={1.5}
            color="white"
            anchorX="center"
            anchorY="middle"
            onDoubleClick={() => {
              const newValue = prompt("Enter distance:", constraint.distance);
              if (newValue !== null && onUpdateConstraintValue) {
                onUpdateConstraintValue(constraint.id, parseFloat(newValue));
              }
            }}
          >
            {constraint.distance.toFixed(2)}
          </Text>
        </group>
      );
    }
    
    if (constraint.type === 'difference') {
      const p1Data = primitives.find(p => p.id === constraint.param1?.o_id)?.data;
      const p2Data = primitives.find(p => p.id === constraint.param2?.o_id)?.data;
      if (!p1Data || !p2Data) return null;
      const isHorizontal = constraint.param1?.prop === 'x';

      // Elbow point: shares the X (horizontal dim) or Y (vertical dim) axis with p1,
      // and the other axis with p2 — matches the standard axis-aligned dimension leader shape.
      const elbow2d = isHorizontal ? { x: p2Data.x, y: p1Data.y } : { x: p1Data.x, y: p2Data.y };

      const p1 = lift({ x: p1Data.x, y: p1Data.y }, workplane);
      const p2 = lift({ x: p2Data.x, y: p2Data.y }, workplane);
      const elbow = lift(elbow2d, workplane);

      const mid2d = { x: (p1Data.x + elbow2d.x) / 2, y: (p1Data.y + elbow2d.y) / 2 };
      const labelOffset = meta?.labelOffset || { x: 10, y: 10 };
      const labelPos = lift({ x: mid2d.x + labelOffset.x, y: mid2d.y + labelOffset.y }, workplane);

      return (
        <group key={constraint.id}>
          <NativePolyline
            points={[[p1.x, p1.y, p1.z], [elbow.x, elbow.y, elbow.z], [p2.x, p2.y, p2.z]]}
            color={dimColor}
          />
          <Text
            position={[labelPos.x, labelPos.y, labelPos.z + 0.1]}
            fontSize={1.5}
            color="white"
            anchorX="center"
            anchorY="middle"
            onDoubleClick={() => {
              const newValue = prompt('Enter distance:', constraint.difference);
              if (newValue !== null && onUpdateConstraintValue) {
                onUpdateConstraintValue(constraint.id, parseFloat(newValue));
              }
            }}
          >
            {constraint.difference.toFixed(2)}
          </Text>
        </group>
      );
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
