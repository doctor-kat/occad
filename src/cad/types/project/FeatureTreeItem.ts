import { Feature } from './Feature';
import { ReferenceGeometry } from './ReferenceGeometry/ReferenceGeometry';
import { Sketch } from '../sketch/Sketch';
import type { FeatureTreeItemType } from './FeatureTreeItemType';

export interface FeatureTreeItem {
  id: string;
  name: string;
  type: FeatureTreeItemType;
  children?: FeatureTreeItem[];
  isExpanded?: boolean;
  visible?: boolean;
  /** True when the item falls after the history rollback bar (greyed, not built). */
  rolledBack?: boolean;
  error?: string;
  data?: ReferenceGeometry | Sketch | Feature;
}
