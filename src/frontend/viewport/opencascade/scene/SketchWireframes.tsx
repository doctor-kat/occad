import { useMemo } from "react";
import * as THREE from "three";
import type { CADProject, SketchEdgeData } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import { computeEdgeSegments } from "../geometry/edgeSegments";

// ---------------------------------------------------------------------------
// Sketch wireframe — renders a single sketch's edge data as purple lines,
// highlighting orange while the sketch is hovered (in the viewport or tree).
// ---------------------------------------------------------------------------
function SketchWireframe({
  sketchId,
  edgeVertices,
  isSelected = false,
  onSelect,
}: {
  sketchId: string;
  edgeVertices: Float32Array;
  isSelected?: boolean;
  onSelect?: (sketchId: string) => void;
}) {
  const hoveredTreeItem = useViewportStore((s) => s.hoveredTreeItem);
  const setHoveredTreeItem = useViewportStore((s) => s.setHoveredTreeItem);
  const isHovered = hoveredTreeItem === sketchId;

  // Selection wins over hover (blue), matching reference-plane / edge convention.
  const color = isSelected ? "#3b82f6" : isHovered ? "#f97316" : "#a64dff";
  const lineWidth = isSelected || isHovered ? 3 : 2;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  const segments = useMemo(() => computeEdgeSegments(edgeVertices), [edgeVertices]);

  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={color} linewidth={lineWidth} />
      </lineSegments>

      {/* Invisible cylinder hit-areas for reliable hover/click detection */}
      {segments.map((seg) => (
        <mesh
          key={`${seg.position.x},${seg.position.y},${seg.position.z}-${seg.length}`}
          position={seg.position}
          quaternion={seg.quaternion}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredTreeItem(sketchId);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHoveredTreeItem(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(sketchId);
          }}
        >
          <cylinderGeometry args={[0.8, 0.8, seg.length, 6]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sketch wireframes — renders visible sketch edges from rebuild data
// ---------------------------------------------------------------------------
export interface SketchWireframesProps {
  project: CADProject;
  sketchEdges: Record<string, SketchEdgeData>;
  /** Currently selected tree item id (highlights the matching sketch blue). */
  selectedSketchId?: string | null;
  onSketchClick?: (sketchId: string) => void;
}

export function SketchWireframes({ project, sketchEdges, selectedSketchId, onSketchClick }: SketchWireframesProps) {
  return (
    <>
      {project.sketches.flatMap((s) =>
        s.isVisible && sketchEdges[s.id]
          ? [
              <SketchWireframe
                key={s.id}
                sketchId={s.id}
                edgeVertices={sketchEdges[s.id].edgeVertices}
                isSelected={selectedSketchId === s.id}
                onSelect={onSketchClick}
              />,
            ]
          : []
      )}
    </>
  );
}
