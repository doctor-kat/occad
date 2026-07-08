import type { CADProject, TessellationQuality } from '@/cad/types';

/** Rebuild entire CAD model from feature history */
export interface RebuildRequest {
    type: 'rebuild';
    project: CADProject;
    /** Mesh resolution for solid bodies. Omitted → worker uses its default. */
    tessellation?: TessellationQuality;
}
