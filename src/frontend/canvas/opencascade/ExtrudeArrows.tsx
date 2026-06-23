import * as THREE from "three";
import type { CADProject } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";

export function ExtrudeArrows({ project }: { project: CADProject }) {
  const preview = useViewportStore((state) => state.extrudePreview);
  if (!preview || !preview.sketchId) return null;

  const sketch = project.sketches.find((s) => s.id === preview.sketchId);
  if (!sketch || !sketch.workplane) return null;

  const { workplane } = sketch;
  const normal = new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z);
  const origin = new THREE.Vector3(workplane.origin.x, workplane.origin.y, workplane.origin.z);

  return (
    <group position={origin}>
      {/* Normal direction arrow */}
      <primitive
        object={(() => {
          const helper = new THREE.ArrowHelper(normal, new THREE.Vector3(0, 0, 0), 20, 0x3b82f6, 5, 3);
          (helper.line.material as any).depthTest = false;
          (helper.cone.material as any).depthTest = false;
          return helper;
        })()}
        renderOrder={100}
      />

      {/* Reverse direction arrow */}
      <primitive
        object={(() => {
          const helper = new THREE.ArrowHelper(normal.clone().negate(), new THREE.Vector3(0, 0, 0), 20, 0xf97316, 5, 3);
          (helper.line.material as any).depthTest = false;
          (helper.cone.material as any).depthTest = false;
          return helper;
        })()}
        renderOrder={100}
      />
    </group>
  );
}
