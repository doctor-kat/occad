import type { CADProject } from '@/cad/types';

/** Rebuild entire CAD model from feature history */
export interface RebuildRequest {
    type: 'rebuild';
    project: CADProject;
}
