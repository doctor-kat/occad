import {
  CADProject,
  Sketch,
  Feature,
  SketchElement,
  OperationParams,
  ShapeReference,
  PlanegcsConstraint,
  FeatureRefEnrichment,
  SketchRefEnrichment,
  compareBuildOrder,
  orderKey,
  rollbackThresholdForIndex,
} from '@/cad/types';
import {
  REORDER_EPSILON,
  sequenceAtBar,
  checkIfSketchClosed,
} from './projectHelpers';

/**
 * Every mutation to the durable {@link CADProject} is expressed as one of these
 * actions and applied by the single pure {@link projectReducer}. This replaces
 * the ~22 bespoke `setProject` callbacks that useCADState used to expose: the
 * version-bump policy (model edits bump `version`; derived/rebuild enrichments
 * and pure visibility toggles do not) now lives in one place, per case.
 */
export type ProjectAction =
  // Whole-project replacement (import, new project, undo/redo replay).
  | { type: 'REPLACE'; project: CADProject }
  // Bump `updatedAt` only (save).
  | { type: 'TOUCH' }
  // Sketches
  | { type: 'ADD_SKETCH'; sketch: Sketch }
  | { type: 'UPDATE_SKETCH_ELEMENTS'; sketchId: string; elements: SketchElement[] }
  | { type: 'UPDATE_SKETCH_STATE'; sketchId: string; sketch: Sketch }
  | { type: 'ADD_CONSTRAINT'; sketchId: string; constraint: PlanegcsConstraint }
  | { type: 'REMOVE_CONSTRAINT'; sketchId: string; constraintId: string }
  | { type: 'UPDATE_SKETCH_GEOMETRY'; sketchId: string; geometry: ShapeReference }
  | { type: 'STOP_SKETCH_EDIT'; sketchId: string }
  | { type: 'DELETE_SKETCH'; sketchId: string }
  // Features
  | { type: 'ADD_FEATURE'; feature: Feature }
  | { type: 'UPDATE_FEATURE_PARAMETERS'; featureId: string; parameters: OperationParams }
  | { type: 'UPDATE_FEATURE_GEOMETRY'; featureId: string; geometry: ShapeReference }
  | { type: 'APPLY_REF_ENRICHMENTS'; enrichments: FeatureRefEnrichment[] }
  | { type: 'APPLY_SKETCH_REF_ENRICHMENTS'; enrichments: SketchRefEnrichment[] }
  | { type: 'TOGGLE_FEATURE_SUPPRESSION'; featureId: string }
  | { type: 'TOGGLE_FEATURE_VISIBILITY'; featureId: string }
  | { type: 'DELETE_FEATURE'; featureId: string }
  | { type: 'REORDER_FEATURE'; featureId: string; newIndex: number }
  // History / tree
  | { type: 'MOVE_ROLLBACK_BAR'; newIndex: number }
  | { type: 'TOGGLE_TREE_ITEM_EXPANSION'; id: string }
  | { type: 'TOGGLE_TREE_ITEM_VISIBILITY'; id: string }
  | { type: 'DELETE_TREE_ITEM'; id: string };

/** Apply `patch` as a model edit: bump `version` (triggers a rebuild) + `updatedAt`. */
const withBump = (prev: CADProject, patch: Partial<CADProject>): CADProject =>
  ({ ...prev, ...patch, version: prev.version + 1, updatedAt: Date.now() });

/** Apply `patch` as a non-model edit (derived data / pure UI): touch `updatedAt` only. */
const touched = (prev: CADProject, patch: Partial<CADProject>): CADProject =>
  ({ ...prev, ...patch, updatedAt: Date.now() });

export function projectReducer(prev: CADProject, action: ProjectAction): CADProject {
  switch (action.type) {
    case 'REPLACE':
      return action.project;

    case 'TOUCH':
      return touched(prev, {});

    case 'ADD_SKETCH':
      // If the history is rolled back, slot the new sketch at the bar so it
      // stays "present" rather than landing past the bar (hidden).
      return withBump(prev, {
        sketches: [...prev.sketches, { ...action.sketch, sequence: sequenceAtBar(prev) }],
      });

    case 'UPDATE_SKETCH_ELEMENTS': {
      const sketch = prev.sketches.find((s) => s.id === action.sketchId);
      if (!sketch) return prev;
      const isClosed = checkIfSketchClosed(action.elements);
      return withBump(prev, {
        sketches: prev.sketches.map((s) =>
          s.id === action.sketchId
            ? { ...s, elements: action.elements, isClosed, updatedAt: Date.now() }
            : s
        ),
      });
    }

    case 'UPDATE_SKETCH_STATE': {
      // Derive isClosed from the elements rather than trusting the round-tripped
      // value (the solver may carry a stale isClosed).
      const isClosed = checkIfSketchClosed(action.sketch.elements);
      return touched(prev, {
        sketches: prev.sketches.map((s) =>
          s.id === action.sketchId ? { ...action.sketch, isClosed, updatedAt: Date.now() } : s
        ),
      });
    }

    case 'ADD_CONSTRAINT': {
      const sketch = prev.sketches.find((s) => s.id === action.sketchId);
      if (!sketch) return prev;
      return withBump(prev, {
        sketches: prev.sketches.map((s) =>
          s.id === action.sketchId
            ? { ...s, constraints: [...(s.constraints || []), action.constraint], updatedAt: Date.now() }
            : s
        ),
      });
    }

    case 'REMOVE_CONSTRAINT': {
      const sketch = prev.sketches.find((s) => s.id === action.sketchId);
      if (!sketch) return prev;
      return withBump(prev, {
        sketches: prev.sketches.map((s) =>
          s.id === action.sketchId
            ? { ...s, constraints: (s.constraints || []).filter((c: any) => c.id !== action.constraintId), updatedAt: Date.now() }
            : s
        ),
      });
    }

    case 'UPDATE_SKETCH_GEOMETRY':
      return touched(prev, {
        sketches: prev.sketches.map((sketch) =>
          sketch.id === action.sketchId ? { ...sketch, geometry: action.geometry, updatedAt: Date.now() } : sketch
        ),
      });

    case 'STOP_SKETCH_EDIT': {
      const sketch = prev.sketches.find((s) => s.id === action.sketchId);
      if (sketch && (!sketch.elements || sketch.elements.length === 0) && (!sketch.primitives || sketch.primitives.length === 0)) {
        return withBump(prev, { sketches: prev.sketches.filter((s) => s.id !== action.sketchId) });
      }
      // Bump version even if not deleted so a rebuild builds the sketch geometry.
      return withBump(prev, {});
    }

    case 'DELETE_SKETCH':
      return withBump(prev, { sketches: prev.sketches.filter((s) => s.id !== action.sketchId) });

    case 'ADD_FEATURE':
      return withBump(prev, {
        // If the history is rolled back, slot the new feature at the bar so it
        // stays "present" rather than landing past the bar (hidden).
        features: [...prev.features, { ...action.feature, sequence: sequenceAtBar(prev) }],
        // Auto-hide consumed sketch
        sketches: action.feature.sketchId
          ? prev.sketches.map((s) =>
              s.id === action.feature.sketchId ? { ...s, isVisible: false, updatedAt: Date.now() } : s
            )
          : prev.sketches,
      });

    case 'UPDATE_FEATURE_PARAMETERS':
      return withBump(prev, {
        features: prev.features.map((feature) =>
          feature.id === action.featureId
            ? { ...feature, parameters: action.parameters, updatedAt: Date.now() }
            : feature
        ),
      });

    case 'UPDATE_FEATURE_GEOMETRY':
      return touched(prev, {
        features: prev.features.map((feature) =>
          feature.id === action.featureId ? { ...feature, geometry: action.geometry, updatedAt: Date.now() } : feature
        ),
      });

    case 'APPLY_REF_ENRICHMENTS': {
      // DERIVED data from a rebuild — must NOT bump `version` (that would loop the
      // rebuild). Converges after one rebuild. See ROADMAP.md (Deterministic topology).
      if (!action.enrichments?.length) return prev;
      let changed = false;
      const features = prev.features.map((feature) => {
        const ours = action.enrichments.filter((e) => e.featureId === feature.id);
        if (!ours.length || !feature.parameters) return feature;
        const parameters: any = { ...feature.parameters };
        for (const e of ours) parameters[e.key] = e.refs;
        changed = true;
        return { ...feature, parameters };
      });
      if (!changed) return prev;
      return { ...prev, features }; // intentionally no version / updatedAt bump
    }

    case 'APPLY_SKETCH_REF_ENRICHMENTS': {
      if (!action.enrichments?.length) return prev;
      let changed = false;
      const sketches = prev.sketches.map((sketch) => {
        const ours = action.enrichments.filter((e) => e.sketchId === sketch.id);
        if (!ours.length) return sketch;
        const byPrimitive = new Map(ours.map((e) => [e.primitiveId, e.ref]));
        let sketchChanged = false;
        const primitives = sketch.primitives.map((primitive) => {
          const ref = byPrimitive.get(primitive.id);
          if (!ref) return primitive;
          sketchChanged = true;
          return { ...primitive, sourceRef: ref };
        });
        if (!sketchChanged) return sketch;
        changed = true;
        return { ...sketch, primitives };
      });
      if (!changed) return prev;
      return { ...prev, sketches }; // intentionally no version / updatedAt bump
    }

    case 'TOGGLE_FEATURE_SUPPRESSION':
      return withBump(prev, {
        features: prev.features.map((feature) =>
          feature.id === action.featureId
            ? { ...feature, isSuppressed: !feature.isSuppressed, updatedAt: Date.now() }
            : feature
        ),
      });

    case 'TOGGLE_FEATURE_VISIBILITY':
      return touched(prev, {
        features: prev.features.map((feature) =>
          feature.id === action.featureId ? { ...feature, isVisible: !feature.isVisible } : feature
        ),
      });

    case 'DELETE_FEATURE':
      return withBump(prev, { features: prev.features.filter((f) => f.id !== action.featureId) });

    case 'REORDER_FEATURE': {
      const ordered = [...prev.features].sort(compareBuildOrder);
      const moved = ordered.find((f) => f.id === action.featureId);
      if (!moved) return prev;

      const without = ordered.filter((f) => f.id !== action.featureId);
      const clamped = Math.max(0, Math.min(action.newIndex, without.length));
      const before = without[clamped - 1];
      const after = without[clamped];

      let sequence: number;
      if (!before && !after) sequence = orderKey(moved);          // only feature
      else if (!before) sequence = orderKey(after) - 1;            // to the front
      else if (!after) sequence = orderKey(before) + 1;            // to the back
      else sequence = (orderKey(before) + orderKey(after)) / 2;    // between two

      // Invariant: a feature must build after its consumed sketch, so its key
      // must stay strictly greater than that sketch's key.
      if (moved.sketchId) {
        const sketch = prev.sketches.find((s) => s.id === moved.sketchId);
        if (sketch) {
          const sketchKey = orderKey(sketch);
          if (sequence <= sketchKey) sequence = sketchKey + REORDER_EPSILON;
        }
      }

      return withBump(prev, {
        features: prev.features.map((f) =>
          f.id === action.featureId ? { ...f, sequence, updatedAt: Date.now() } : f
        ),
      });
    }

    case 'MOVE_ROLLBACK_BAR': {
      const sketchIdsUsedByFeatures = new Set(
        prev.features.flatMap((f) => (f.sketchId ? [f.sketchId] : []))
      );
      const keys = [
        ...prev.sketches.filter((s) => !sketchIdsUsedByFeatures.has(s.id)),
        ...prev.features,
      ]
        .sort(compareBuildOrder)
        .map(orderKey);
      const rollbackBar = rollbackThresholdForIndex(keys, action.newIndex);
      if (rollbackBar === prev.rollbackBar) return prev;
      return withBump(prev, { rollbackBar });
    }

    case 'TOGGLE_TREE_ITEM_EXPANSION':
      // Only features can be expanded/collapsed
      return touched(prev, {
        features: prev.features.map((f) =>
          f.id === action.id ? { ...f, isExpanded: !f.isExpanded } : f
        ),
      });

    case 'TOGGLE_TREE_ITEM_VISIBILITY':
      return touched(prev, {
        sketches: prev.sketches.map((sketch) =>
          sketch.id === action.id ? { ...sketch, isVisible: !sketch.isVisible } : sketch
        ),
        features: prev.features.map((feature) =>
          feature.id === action.id ? { ...feature, isVisible: !feature.isVisible } : feature
        ),
        referenceGeometry: prev.referenceGeometry.map((ref) =>
          ref.id === action.id ? { ...ref, isVisible: !ref.isVisible } : ref
        ),
      });

    case 'DELETE_TREE_ITEM': {
      // Try to delete from sketches
      const filteredSketches = prev.sketches.filter((s) => s.id !== action.id);
      if (filteredSketches.length !== prev.sketches.length) {
        return withBump(prev, { sketches: filteredSketches });
      }
      // Try to delete from features
      const filteredFeatures = prev.features.filter((f) => f.id !== action.id);
      if (filteredFeatures.length !== prev.features.length) {
        return withBump(prev, { features: filteredFeatures });
      }
      // Reference geometry cannot be deleted
      return prev;
    }

    default: {
      // Exhaustiveness guard: a new action type must add a case above.
      const _never: never = action;
      return _never;
    }
  }
}
