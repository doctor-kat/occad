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
  /**
   * History rollback marker (SolidWorks-style rollback bar). A threshold in the
   * `orderKey` (epoch-ms) domain: any sketch/feature whose build-order key is
   * **strictly greater** than this is "rolled back" — skipped during rebuild and
   * greyed in the feature tree, but not deleted. `undefined` means the bar is at
   * the bottom (nothing rolled back). See `isRolledBack` and ROADMAP.md §8.
   */
  rollbackBar?: number;
}
