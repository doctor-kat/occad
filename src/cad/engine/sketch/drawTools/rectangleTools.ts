import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import {
  buildCenterRectangle,
  centerRectangleGuides,
  buildThreePointCornerRectangle,
  buildThreePointCenterRectangle,
  buildParallelogram,
} from '@/cad/engine/sketch/sketchShapeBuilders';
import type { DrawToolHandler } from './types';

/** Two-click axis-aligned rectangle: opposite corners. */
export const rectangleTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length === 0) return { kind: 'continue', points: [snappedPoint] };
    return {
      kind: 'complete',
      elements: [{
        type: SketchElementType.RECTANGLE,
        id: crypto.randomUUID(),
        corner1: points[0],
        corner2: snappedPoint,
      }],
    };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length !== 1) return null;
    return {
      type: SketchElementType.RECTANGLE,
      id: 'preview',
      corner1: points[0],
      corner2: snappedPoint,
    } as SketchElement;
  },
};

/** Two-click center rectangle: first click is the center, second a corner.
 *  Also emits the center point and two construction diagonals as one group,
 *  mirroring SolidWorks' center-rectangle relations. */
export const centerRectangleTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length === 0) return { kind: 'continue', points: [snappedPoint] };
    const { corner1, corner2 } = buildCenterRectangle(points[0], snappedPoint);
    // The rectangle, its center point, and the two construction diagonals form
    // one composite group so they select / delete / hover as a single unit.
    const groupId = crypto.randomUUID();
    const groupType = 'center-rectangle' as const;
    const newRect: SketchElement = {
      type: SketchElementType.RECTANGLE,
      id: crypto.randomUUID(),
      corner1,
      corner2,
      groupId,
      groupType,
    };
    const { diagonals, center } = centerRectangleGuides(corner1, corner2);
    const centerPoint: SketchElement = {
      type: SketchElementType.POINT,
      id: crypto.randomUUID(),
      x: center.x,
      y: center.y,
      groupId,
      groupType,
    };
    const diagLines: SketchElement[] = diagonals.map(([start, end]) => ({
      type: SketchElementType.LINE,
      id: crypto.randomUUID(),
      start,
      end,
      construction: true,
      groupId,
      groupType,
    }));
    return { kind: 'complete', elements: [newRect, centerPoint, ...diagLines] };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length !== 1) return null;
    const { corner1, corner2 } = buildCenterRectangle(points[0], snappedPoint);
    return { type: SketchElementType.RECTANGLE, id: 'preview', corner1, corner2 } as SketchElement;
  },
};

/** Three-click rectangle: first edge, then the third click sets the opposite side. */
export const threePointCornerRectangleTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length < 2) return { kind: 'continue', points: [...points, snappedPoint] };
    return {
      kind: 'complete',
      elements: [{
        type: SketchElementType.POLYGON,
        id: crypto.randomUUID(),
        points: buildThreePointCornerRectangle(points[0], points[1], snappedPoint),
      }],
    };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length === 1) {
      return { type: SketchElementType.LINE, id: 'preview', start: points[0], end: snappedPoint } as SketchElement;
    }
    if (points.length === 2) {
      return {
        type: SketchElementType.POLYGON,
        id: 'preview',
        points: buildThreePointCornerRectangle(points[0], points[1], snappedPoint),
      } as SketchElement;
    }
    return null;
  },
};

/** Three-click rectangle defined about a center: first edge through the
 *  center, then the third click sets the half-width. */
export const threePointCenterRectangleTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length < 2) return { kind: 'continue', points: [...points, snappedPoint] };
    return {
      kind: 'complete',
      elements: [{
        type: SketchElementType.POLYGON,
        id: crypto.randomUUID(),
        points: buildThreePointCenterRectangle(points[0], points[1], snappedPoint),
      }],
    };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length === 1) {
      return { type: SketchElementType.LINE, id: 'preview', start: points[0], end: snappedPoint } as SketchElement;
    }
    if (points.length === 2) {
      return {
        type: SketchElementType.POLYGON,
        id: 'preview',
        points: buildThreePointCenterRectangle(points[0], points[1], snappedPoint),
      } as SketchElement;
    }
    return null;
  },
};

/** Three-click parallelogram: first edge, then the third click sets the skew. */
export const parallelogramTool: DrawToolHandler = {
  onClick: ({ points, snappedPoint }) => {
    if (points.length < 2) return { kind: 'continue', points: [...points, snappedPoint] };
    return {
      kind: 'complete',
      elements: [{
        type: SketchElementType.POLYGON,
        id: crypto.randomUUID(),
        points: buildParallelogram(points[0], points[1], snappedPoint),
      }],
    };
  },
  onPreview: ({ points, snappedPoint }) => {
    if (points.length === 1) {
      return { type: SketchElementType.LINE, id: 'preview', start: points[0], end: snappedPoint } as SketchElement;
    }
    if (points.length === 2) {
      return {
        type: SketchElementType.POLYGON,
        id: 'preview',
        points: buildParallelogram(points[0], points[1], snappedPoint),
      } as SketchElement;
    }
    return null;
  },
};
