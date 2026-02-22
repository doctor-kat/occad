import { Feature } from './Feature';
import { ReferenceGeometry } from './ReferenceGeometry/ReferenceGeometry';
import { Sketch } from '../sketch/Sketch';

export interface CADProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Version number for parametric rebuild tracking */
  version: number;
  referenceGeometry: ReferenceGeometry[];
  sketches: Sketch[];
  features: Feature[];
}
