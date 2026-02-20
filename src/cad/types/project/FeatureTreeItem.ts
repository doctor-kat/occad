import { Feature } from './Feature';
import { ReferenceGeometry } from './ReferenceGeometry';
import { Sketch } from '../sketch/Sketch';

export enum FeatureTreeItemType {
  REFERENCE_GEOMETRY = 'reference-geometry',
  SKETCH = 'sketch',
  FEATURE = 'feature'
}

export interface FeatureTreeItem {
  id: string;
  name: string;
  type: FeatureTreeItemType;
  children?: FeatureTreeItem[];
  isExpanded?: boolean;
  visible?: boolean;
  error?: string;
  data?: ReferenceGeometry | Sketch | Feature;
}
