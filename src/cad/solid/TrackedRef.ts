type TopoDS_Shape = any;

/** An id-tagged live sub-shape carried through a chain of operations. */
export interface TrackedRef {
  /** Stable id (e.g. the originating `edge-N` / `face-N` or a persistent id). */
  id: string;
  /** The current live OCC sub-shape this id resolves to. */
  shape: TopoDS_Shape;
}
