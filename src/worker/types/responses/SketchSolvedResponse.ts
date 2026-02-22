import { MeshData } from '@/cad/types/mesh/MeshData';
import { Sketch } from '@/cad/types/sketch/Sketch';

export interface SketchSolvedResponse {
  type: 'sketchSolved';
  solvedSketch: Sketch;
  meshData: MeshData;
}
