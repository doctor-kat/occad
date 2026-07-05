/**
 * Loft parameters: build a solid through a series of (closed) profile sketches.
 * The profiles are lofted in order via BRepOffsetAPI_ThruSections.
 */
export interface LoftParams {
  /** Ordered sketch ids of the profiles to loft through (2 or more). */
  sketchIds: string[];
  /** Straight (ruled) transitions between sections instead of smooth. */
  ruled?: boolean;
  /** Whether this removes material (subtract) instead of adding it (union). */
  isCut?: boolean;
}
