import {
  Sketch,
  Feature,
  SketchPlane,
  OperationParams,
} from '@/cad/types';
import { createWorkplane } from './projectHelpers';

/**
 * Construct a fresh Sketch on the given plane. The impure bits (uuid, clock)
 * live here so {@link projectReducer}'s ADD_SKETCH case stays pure. Returns the
 * sketch so callers can reference the new id immediately.
 */
export function makeSketch(name: string, plane: SketchPlane): Sketch {
  const workplane = createWorkplane(plane.type, plane.origin, plane.normal, plane.offset || 0);
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    workplane,
    primitives: [],
    elements: [],
    constraints: [],
    visualMetadata: {},
    isClosed: false,
    isVisible: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Construct a fresh Feature. Impure bits kept out of the reducer, as with makeSketch. */
export function makeFeature(
  name: string,
  type: Feature['type'],
  parameters?: OperationParams,
  sketchId?: string,
  parentIds: string[] = []
): Feature {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    type,
    sketchId,
    parameters,
    parentIds,
    isSuppressed: false,
    isVisible: true,
    createdAt: now,
    updatedAt: now,
    isExpanded: true,
  };
}
