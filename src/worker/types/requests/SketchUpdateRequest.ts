import { Sketch } from '@/cad/types/sketch/Sketch';

export interface SketchUpdateRequest {
  type: 'sketchUpdateRequest';
  sketch: Sketch;
}
