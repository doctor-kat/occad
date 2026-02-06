// CAD Application Types

export type ToolCategory = 'features' | 'sketch' | 'evaluate';

export type FeatureTool = 
  | 'extrude-boss'
  | 'revolved-boss'
  | 'extruded-cut'
  | 'revolved-cut'
  | 'fillet'
  | 'chamfer';

export type SketchTool = 
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'polygon'
  | 'arc';

export type EvaluateTool = 'measure';

export type Tool = FeatureTool | SketchTool | EvaluateTool | null;

export interface Sketch {
  id: string;
  name: string;
  plane: string;
  createdAt: number;
}

export interface Feature {
  id: string;
  name: string;
  type: FeatureTool;
  sketchId?: string;
  createdAt: number;
  isExpanded?: boolean;
}

export interface ReferenceGeometry {
  id: string;
  name: string;
  type: 'plane' | 'origin';
}

export interface FeatureTreeItem {
  id: string;
  name: string;
  type: 'reference-geometry' | 'sketch' | 'feature';
  children?: FeatureTreeItem[];
  isExpanded?: boolean;
  data?: ReferenceGeometry | Sketch | Feature;
}

export interface CADProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  referenceGeometry: ReferenceGeometry[];
  sketches: Sketch[];
  features: Feature[];
}

export interface CADState {
  project: CADProject;
  activeTab: ToolCategory;
  activeTool: Tool;
  selectedTreeItem: string | null;
  isSidebarOpen: boolean;
}

// Default reference geometry that always exists
export const DEFAULT_REFERENCE_GEOMETRY: ReferenceGeometry[] = [
  { id: 'front-plane', name: 'Front Plane', type: 'plane' },
  { id: 'top-plane', name: 'Top Plane', type: 'plane' },
  { id: 'right-plane', name: 'Right Plane', type: 'plane' },
  { id: 'origin', name: 'Origin', type: 'origin' },
];

export const createNewProject = (): CADProject => ({
  id: crypto.randomUUID(),
  name: 'Untitled Project',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  referenceGeometry: DEFAULT_REFERENCE_GEOMETRY,
  sketches: [],
  features: [],
});