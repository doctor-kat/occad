import * as THREE from "three";
import type { CADProject } from "@/cad/types";
import { PlaneType } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";

export function ExtrudeArrows({ project }: { project: CADProject }) {
  const preview = useViewportStore((state) => state.extrudePreview);
  if (!preview || !preview.sketchId) return null;

  const sketch = project.sketches.find((s) => s.id === preview.sketchId);
  if (!sketch) return null;

  // Calculate plane normal and origin
  const getSketchNormal = (plane: any): THREE.Vector3 => {
    if (plane.normal) return new THREE.Vector3(plane.normal.x, plane.normal.y, plane.normal.z);
    switch (plane.type) {
      case PlaneType.XY: return new THREE.Vector3(0, 0, 1);
      case PlaneType.XZ: return new THREE.Vector3(0, 1, 0);
      case PlaneType.YZ: return new THREE.Vector3(1, 0, 0);
      default: return new THREE.Vector3(0, 0, 1);
    }
  };

  const getSketchOrigin = (plane: any): THREE.Vector3 => {
    if (plane.origin) return new THREE.Vector3(plane.origin.x, plane.origin.y, plane.origin.z);
    return new THREE.Vector3(0, 0, 0);
  };

  const normal = getSketchNormal(sketch.plane);
  const origin = getSketchOrigin(sketch.plane);

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
