import { Sphere } from '@react-three/drei';
import { Sketch } from '@/cad/types';
import { lift } from '@/cad/engine/sketch/coordinateSystem';
import { NativePolyline } from '../NativePolyline';
import { centerPointId } from '../dimensionGeometryUtils';

interface SketchPrimitivesProps {
  sketch: Sketch;
  defaultColor: string;
}

/** Renders the sketch's geometric primitives (lines, points, circles, arcs). */
export function SketchPrimitives({ sketch, defaultColor }: SketchPrimitivesProps) {
  const { workplane, primitives } = sketch;

  return (
    <>
      {primitives.map((primitive) => {
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
      })}
    </>
  );
}
