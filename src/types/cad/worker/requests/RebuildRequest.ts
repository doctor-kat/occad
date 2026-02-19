import type { CADProject } from '../../project';

/** Rebuild entire CAD model from feature history */
export interface RebuildRequest {
    type: 'rebuild';
    project: CADProject;
}
