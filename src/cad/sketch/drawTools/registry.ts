import { SketchOperation } from '@/cad/types';
import type { DrawToolHandler } from './types';
import { pointTool } from './pointTool';
import { lineTool, centerlineTool, midpointLineTool } from './lineTools';
import {
  rectangleTool,
  centerRectangleTool,
  threePointCornerRectangleTool,
  threePointCenterRectangleTool,
  parallelogramTool,
} from './rectangleTools';
import { circleTool, perimeterCircleTool } from './circleTools';
import { polygonTool } from './polygonTool';
import { arcTool, centerpointArcTool, tangentArcTool } from './arcTools';

export type { DrawToolHandler, DrawToolContext, DrawToolClickResult } from './types';

/**
 * Maps each geometry-placing `SketchOperation` to the handler that builds its
 * click/preview elements. Selection mode (`activeOperation` null) and the
 * Dimension tool aren't geometry-placing tools, so they're handled separately
 * in SketchOverlay rather than through this registry.
 */
export const drawToolRegistry: Partial<Record<SketchOperation, DrawToolHandler>> = {
  [SketchOperation.POINT]: pointTool,
  [SketchOperation.LINE]: lineTool,
  [SketchOperation.CENTERLINE]: centerlineTool,
  [SketchOperation.MIDPOINT_LINE]: midpointLineTool,
  [SketchOperation.RECTANGLE]: rectangleTool,
  [SketchOperation.CENTER_RECTANGLE]: centerRectangleTool,
  [SketchOperation.THREE_POINT_CORNER_RECTANGLE]: threePointCornerRectangleTool,
  [SketchOperation.THREE_POINT_CENTER_RECTANGLE]: threePointCenterRectangleTool,
  [SketchOperation.PARALLELOGRAM]: parallelogramTool,
  [SketchOperation.CIRCLE]: circleTool,
  [SketchOperation.PERIMETER_CIRCLE]: perimeterCircleTool,
  [SketchOperation.POLYGON]: polygonTool,
  [SketchOperation.ARC]: arcTool,
  [SketchOperation.CENTERPOINT_ARC]: centerpointArcTool,
  [SketchOperation.TANGENT_ARC]: tangentArcTool,
};
