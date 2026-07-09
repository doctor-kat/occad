type TopoDS_Shape = any;

/**
 * Uniform view over OCC's two history sources. Booleans expose history via a
 * `History()` `BRepTools_History` (which reports removal as `IsRemoved`); the
 * `MakeShape` family answers `Modified`/`Generated`/`IsDeleted` directly. Both
 * are adapted to this single shape so the propagation logic is source-agnostic.
 */
export interface ShapeHistory {
  modified(sub: TopoDS_Shape): TopoDS_Shape[];
  generated(sub: TopoDS_Shape): TopoDS_Shape[];
  isRemoved(sub: TopoDS_Shape): boolean;
}
