import { useMemo } from "react";
import * as THREE from "three";
import type { MeshData } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import { groupEdgeSegmentsByEdge } from "../geometry/occGeometry.ts";

export interface EdgeWireframeProps {
  mesh: MeshData;
  selectedEdgeIndex?: number | null;
  inSketchMode: boolean;
}

/** Wireframe edges, grouped by topological edge so a whole CAD edge highlights as a unit. */
export function EdgeWireframe({ mesh, selectedEdgeIndex, inSketchMode }: EdgeWireframeProps) {
  const hoveredEdgeIndex = useViewportStore((state) => state.hoveredEdgeIndex);
  // Extra edges lit up by "Select Loop" (a whole bounding wire).
  const selectedEdgeIndices = useViewportStore((state) => state.selectedEdgeIndices);

  const lines = useMemo(() => {
    const edgeGroups = groupEdgeSegmentsByEdge(mesh);
    const selectedEdgeIndexSet = new Set(selectedEdgeIndices);

    return edgeGroups.map(({ edgeId, vertices }) => {
      const isSelected = selectedEdgeIndex === edgeId || selectedEdgeIndexSet.has(edgeId);
      const isHovered = !inSketchMode && hoveredEdgeIndex === edgeId;

      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

      return (
        <lineSegments key={edgeId} geometry={edgeGeometry}>
          <lineBasicMaterial
            color={
              isSelected
                ? "#3b82f6" // Blue when selected
                : isHovered
                  ? "#f97316" // Orange when hovered
                  : "#222233" // Darker gray/navy for better contrast
            }
            linewidth={isSelected ? 3 : isHovered ? 2 : 1}
            transparent
            opacity={isSelected ? 1 : isHovered ? 0.9 : 0.8}
          />
        </lineSegments>
      );
    });
  }, [mesh.edgeVertices, mesh.edgeMapping, selectedEdgeIndex, selectedEdgeIndices, hoveredEdgeIndex, inSketchMode]);

  return <>{lines}</>;
}
