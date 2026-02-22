import { useMemo } from "react";
import * as THREE from "three";
import type { CADProject, SketchEdgeData } from "@/cad/types";

// ---------------------------------------------------------------------------
// Sketch wireframe — renders a single sketch's edge data as purple lines
// ---------------------------------------------------------------------------
export function SketchWireframe({ edgeVertices }: { edgeVertices: Float32Array }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(edgeVertices, 3));
    return geo;
  }, [edgeVertices]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#a64dff" linewidth={2} />
    </lineSegments>
  );
}

// ---------------------------------------------------------------------------
// Sketch wireframes — renders visible sketch edges from rebuild data
// ---------------------------------------------------------------------------
export interface SketchWireframesProps {
  project: CADProject;
  sketchEdges: Record<string, SketchEdgeData>;
}

export function SketchWireframes({ project, sketchEdges }: SketchWireframesProps) {
  return (
    <>
      {project.sketches
        .filter((s) => s.isVisible && sketchEdges[s.id])
        .map((s) => (
          <SketchWireframe key={s.id} edgeVertices={sketchEdges[s.id].edgeVertices} />
        ))}
    </>
  );
}
