import { CADProject } from './CADProject';
import { DEFAULT_REFERENCE_GEOMETRY } from './ReferenceGeometry';
import { SketchElementType } from '../sketch/SketchElementType';
import { FeatureTool } from '../tools/FeatureTool';
import { PlaneType } from '../sketch/SketchPlane';

export const createNewProject = (): CADProject => {
  const now = Date.now();
  const defaultSketchId = crypto.randomUUID();
  const defaultExtrudeId = crypto.randomUUID();

  return {
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    createdAt: now,
    updatedAt: now,
    version: 1,
    referenceGeometry: DEFAULT_REFERENCE_GEOMETRY,
    sketches: [
      {
        id: defaultSketchId,
        name: 'Sketch1',
        plane: {
          type: PlaneType.XY,
          planeRef: 'front-plane',
          offset: 0,
        },
        elements: [
          {
            type: SketchElementType.RECTANGLE,
            corner1: { x: -25, y: -25 },
            corner2: { x: 25, y: 25 },
          } as any, // Use any here temporarily to avoid complex union cast in this helper
        ],
        isClosed: true,
        isVisible: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    features: [
      {
        id: defaultExtrudeId,
        name: 'Boss-Extrude1',
        type: FeatureTool.EXTRUDE_BOSS,
        sketchId: defaultSketchId,
        parameters: {
          distance: 50,
          direction: { x: 0, y: 0, z: 1 },
          isCut: false,
        },
        parentIds: [defaultSketchId],
        isSuppressed: false,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
};
