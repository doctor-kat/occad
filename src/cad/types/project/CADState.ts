import { CADProject } from './CADProject';
import { RebuildState } from './RebuildState';
import { Operation } from '../operations/Operation';
import { OperationCategory } from '../operations/OperationCategory';

export interface CADState {
  project: CADProject;
  activeTab: OperationCategory;
  activeOperation: Operation;
  selectedTreeItem: string | null;
  isSidebarOpen: boolean;
  /** Current rebuild state */
  rebuildState: RebuildState;
  /** Active sketch being edited (if in sketch mode) */
  activeSketchId: string | null;
}
