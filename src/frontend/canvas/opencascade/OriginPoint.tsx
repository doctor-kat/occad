import * as THREE from "three";

export interface OriginPointProps {
  visible: boolean;
  selectedPlaneId: string | null;
  dimmed?: boolean;
}

export function OriginPoint({ visible, selectedPlaneId, dimmed = false }: OriginPointProps) {
  if (!visible) return null;

  const isSelected = selectedPlaneId === 'origin';
  const size = isSelected ? 0.8 : 0.5;
  const axisLength = 7.5;

  const sphereOpacity = dimmed ? 0.2 : isSelected ? 1 : 0.8;
  const axisOpacity = dimmed ? 0.15 : 0.6;

  return (
    <group renderOrder={1000}>
      {/* Origin sphere */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? "#ffffff" : "#888888"}
          transparent
          opacity={sphereOpacity}
          depthTest={false}
        />
      </mesh>

      {/* X axis - Red */}
      <mesh position={[axisLength / 2, 0, 0]}>
        <boxGeometry args={[axisLength, 0.2, 0.2]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={axisOpacity} depthTest={false} />
      </mesh>

      {/* Y axis - Green */}
      <mesh position={[0, axisLength / 2, 0]}>
        <boxGeometry args={[0.2, axisLength, 0.2]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={axisOpacity} depthTest={false} />
      </mesh>

      {/* Z axis - Blue */}
      <mesh position={[0, 0, axisLength / 2]}>
        <boxGeometry args={[0.2, 0.2, axisLength]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={axisOpacity} depthTest={false} />
      </mesh>
    </group>
  );
}
