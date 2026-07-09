/**
 * Tessellation quality settings.
 *
 * Controls how finely OpenCascade meshes shapes for display — chiefly how many
 * facets curved surfaces (spheres, cylinders, fillets, …) are broken into.
 * Lower deflection values mean the mesh hugs the true surface more tightly, so
 * more triangles/faces are generated (smoother look, slower rebuild).
 *
 * - `linearDeflection`  — max distance (model units) between the mesh and the
 *   real surface. Drives overall triangle density.
 * - `angularDeflection` — max angle (radians) between adjacent facet normals.
 *   This is the dominant control of the facet count *around* a curve.
 */
export interface TessellationQuality {
  linearDeflection: number;
  angularDeflection: number;
}
