import { useMemo } from "react";
import type { MeshData } from "@/cad/types";
import { buildFaceGeometry } from "./occGeometry.ts";
import { FaceMesh } from "./FaceMesh.tsx";
import { EdgeWireframe } from "./EdgeWireframe.tsx";
import { EdgeHoverCylinders } from "./EdgeHoverCylinders.tsx";
import { VertexPoints } from "./VertexPoints.tsx";

export interface OCCModelProps {
  mesh: MeshData;
  selectedFaceId?: number | null;
  selectedEdgeIndex?: number | null;
  selectedVertexIndex?: number | null;
  inSketchMode?: boolean;
  onFaceClick?: (faceId: number) => void;
  onEdgeClick?: (edgeIndex: number) => void;
  onVertexClick?: (vertexIndex: number) => void;
}

export function OCCModel({
  mesh,
  selectedFaceId,
  selectedEdgeIndex,
  selectedVertexIndex,
  inSketchMode = false,
  onFaceClick,
  onEdgeClick,
  onVertexClick,
}: OCCModelProps) {
  const faceGeometry = useMemo(() => buildFaceGeometry(mesh), [mesh.faceVertices, mesh.faceNormals, mesh.faceIndices]);

  return (
    <group>
      <FaceMesh
        mesh={mesh}
        faceGeometry={faceGeometry}
        selectedFaceId={selectedFaceId}
        inSketchMode={inSketchMode}
        onFaceClick={onFaceClick}
      />

      <EdgeWireframe mesh={mesh} selectedEdgeIndex={selectedEdgeIndex} inSketchMode={inSketchMode} />

      {!inSketchMode && (
        <EdgeHoverCylinders mesh={mesh} selectedEdgeIndex={selectedEdgeIndex} onEdgeClick={onEdgeClick} />
      )}

      <VertexPoints
        mesh={mesh}
        selectedVertexIndex={selectedVertexIndex}
        inSketchMode={inSketchMode}
        onVertexClick={onVertexClick}
      />
    </group>
  );
}
