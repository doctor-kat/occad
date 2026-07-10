import type { ThreeEvent } from '@react-three/fiber';
import type { Sketch } from '@/cad/types';
import { SketchOperation } from '@/cad/types';
import type { DimTarget } from '../hooks/useDimensionTool';
import { SketchElementRenderer3D } from '../SketchElementRenderer3D';

export interface SketchElementsLayerProps {
  sketch: Sketch;
  activeOperation: SketchOperation | null;
  hoveredElementId: string | null;
  hoveredDimTargetId: string | null;
  selectedElementIds: Set<string>;
  pendingDimTarget: DimTarget | null;
  onPickPoint: (id: string, event: ThreeEvent<MouseEvent>) => void;
}

/**
 * Renders the sketch's committed elements plus, in selection/Dimension mode,
 * a pickable handle mesh at every point primitive (for coincident/distance
 * constraints).
 */
export function SketchElementsLayer({
  sketch,
  activeOperation,
  hoveredElementId,
  hoveredDimTargetId,
  selectedElementIds,
  pendingDimTarget,
  onPickPoint,
}: SketchElementsLayerProps) {
  return (
    <>
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
              onClick={(e: ThreeEvent<MouseEvent>) => onPickPoint(p.id, e)}
            >
              <circleGeometry args={[isSel ? 1.6 : 1.1, 20]} />
              <meshBasicMaterial color={color} transparent opacity={isSel ? 0.95 : 0.6} depthTest={false} />
            </mesh>,
          ];
        })}
    </>
  );
}
