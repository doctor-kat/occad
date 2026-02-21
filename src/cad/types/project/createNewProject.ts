import { CADProject } from './CADProject';
import { DEFAULT_REFERENCE_GEOMETRY } from './ReferenceGeometry';
import { SketchElementType } from '../sketch/SketchElementType';
import { FeatureOperation } from '../operations/FeatureOperation';
import { PlaneType } from '../sketch/SketchPlane';

export const createNewProject = (): CADProject => {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    createdAt: now,
    updatedAt: now,
    version: 1,
    referenceGeometry: DEFAULT_REFERENCE_GEOMETRY,
    sketches: [],
    features: [],
  };
};
