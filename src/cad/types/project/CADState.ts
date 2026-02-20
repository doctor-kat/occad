import { CADProject } from './CADProject';
import { RebuildState } from './RebuildState';
import { Tool } from '../tools/Tool';
import { ToolCategory } from '../tools/ToolCategory';

export interface CADState {
  project: CADProject;
  activeTab: ToolCategory;
  activeTool: Tool;
  selectedTreeItem: string | null;
  isSidebarOpen: boolean;
  /** Current rebuild state */
  rebuildState: RebuildState;
  /** Active sketch being edited (if in sketch mode) */
  activeSketchId: string | null;
}
