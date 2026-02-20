import { FeatureTool } from './FeatureTool';
import { SketchTool } from './SketchTool';
import { EvaluateTool } from './EvaluateTool';
import { TransformTool } from './TransformTool';
import { IOTool } from './IOTool';

export type Tool = FeatureTool | SketchTool | EvaluateTool | TransformTool | IOTool | null;
