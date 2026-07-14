import { useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import type { CADProject, Sketch, SketchElement, ConstraintInput } from '@/cad/types';
import { OperationCategory } from '@/cad/types';
import { mapElementsToPrimitives } from '@/cad/engine/sketch/elementsToPrimitives';
import { withMidpointPoint } from '@/frontend/viewport/contextMenu/sketchMidpoint';
import { withOriginPrimitive, inferOriginCoincidence } from '@/cad/engine/sketch/originPoint';
import { inferAutoConstraints } from '@/cad/engine/sketch/autoConstraints';
import { createConstraint } from '@/cad/engine/sketch/constraintFactory';
import { removeUnit } from '@/cad/engine/sketch/sketchGroups';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { useCadLayoutUiStore } from '../cadLayoutUiStore';

interface UseSketchEditingArgs {
  project: CADProject;
  activeSketchId: string | null;
  updateSketchElements: (sketchId: string, elements: SketchElement[]) => void;
  updateSketchState: (sketchId: string, sketch: Sketch) => void;
  addConstraint: (sketchId: string, constraint: any) => void;
  removeConstraint: (sketchId: string, constraintId: string) => void;
  buildSketch: (sketch: Sketch) => void;
  stopSketchEdit: () => void;
  selectOperation: (operation: any) => void;
}

// Sketch element/constraint mutation handlers and the sketch-mode entities-tab
// sync effect. Most mutation paths funnel through `applySketchElements`, which
// re-derives primitives + auto-constraints and re-solves via the worker.
export function useSketchEditing({
  project,
  activeSketchId,
  updateSketchElements,
  updateSketchState,
  addConstraint,
  removeConstraint,
  buildSketch,
  stopSketchEdit,
  selectOperation,
}: UseSketchEditingArgs) {
  const setActiveSidebarTab = useCadLayoutUiStore((s) => s.setActiveSidebarTab);

  // While editing a sketch, surface its entity list in the left sidebar so the
  // selection (incl. box/crossing select) is visible. Switch to the Entities tab
  // on entering sketch mode and back to the feature tree on exit.
  useEffect(() => {
    setActiveSidebarTab(activeSketchId ? 'entities' : OperationCategory.FEATURES);
  }, [activeSketchId, setActiveSidebarTab]);

  // Apply a set of sketch elements (map → primitives, regenerate auto-relations,
  // re-solve). `extraConstraints` are additional manual constraints to merge in
  // atomically with the element change (e.g. a midpoint relation created together
  // with its point) — deterministically-ided so re-runs stay idempotent.
  const applySketchElements = (
    sketchId: string,
    elements: SketchElement[],
    extraConstraints: any[] = [],
  ) => {
    // First update local elements so UI reflects changes immediately if needed
    updateSketchElements(sketchId, elements);

    // Then trigger worker build/solve
    const sketch = project.sketches.find((s) => s.id === sketchId);
    if (sketch) {
      // Merge mapped primitives with existing ones (to keep external geometry)
      const newPrimitives = mapElementsToPrimitives(elements);
      const externalPrims = sketch.primitives.filter(p => p.isExternal);

      // Regenerate auto-constraints (e.g. a rectangle's H/V relations) from the
      // current elements every edit — deterministic ids make this idempotent.
      // Keep the user's manual constraints (untagged) and replace the inferred set;
      // drop any manual constraint an extra one replaces (same id) so it's not doubled.
      const extraIds = new Set(extraConstraints.map((c) => c.id));
      const manualConstraints = (sketch.constraints || []).filter((c: any) => !c.auto && !extraIds.has(c.id));
      // Auto-relations: a rectangle's H/V edges + coincidence for any endpoint/
      // corner/center snapped onto the origin (see originPoint.inferOriginCoincidence).
      const autoConstraints = [...inferAutoConstraints(elements), ...inferOriginCoincidence(elements)];

      buildSketch({
        ...sketch,
        elements,
        // Every sketch carries a fixed origin point primitive (the (0,0) of the
        // workplane) so geometry can be constrained to it; see originPoint.ts.
        primitives: withOriginPrimitive([...newPrimitives, ...externalPrims]),
        constraints: [...manualConstraints, ...extraConstraints, ...autoConstraints],
      });
    }
  };

  // Handle sketch update
  const handleUpdateSketch = (sketchId: string, elements: SketchElement[]) => {
    applySketchElements(sketchId, elements);
  };

  // "Select Midpoint": materialize (or reuse) a construction point at a line's
  // midpoint and tie it there parametrically with a midpoint constraint, so it
  // tracks the line as the sketch solves, then select it.
  const handleSelectMidpoint = (lineId: string) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    const { elements: nextElements, pointId } = withMidpointPoint(sketch.elements, lineId);
    if (!pointId) return;
    // Endpoints of the line map to `${lineId}_p1`/`_p2`; the midpoint point's
    // primitive id is its element id. p2p_symmetric_ppp binds the point to the mid.
    const midConstraint = createConstraint(`${lineId}_mid_sym`, {
      kind: 'midpoint', p1Id: `${lineId}_p1`, p2Id: `${lineId}_p2`, midId: pointId,
    });
    applySketchElements(activeSketchId, nextElements, [midConstraint]);
    useViewportStore.getState().setSketchElementSelection([pointId]);
  };

  // Delete an entity from the active sketch (from the sidebar entity list). If the
  // target is a group (or a grouped element), the whole composite is removed in one step.
  const handleRemoveSketchElement = (elementId: string) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    handleUpdateSketch(activeSketchId, removeUnit(sketch.elements, elementId));
  };

  // Handle finish sketch
  const handleFinishSketch = () => {
    stopSketchEdit();
    selectOperation(null); // Deselect operation
    notifications.show({ color: 'green', message: 'Sketch completed' });
  };

  // Handle cancel sketch
  const handleCancelSketch = () => {
    stopSketchEdit();
    selectOperation(null); // Deselect operation
    notifications.show({ color: 'blue', message: 'Sketch cancelled' });
  };

  // Apply a geometric constraint to the active sketch from the constraint toolbar.
  const handleApplyConstraint = (input: ConstraintInput) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    const constraint = createConstraint(crypto.randomUUID(), input);
    const updatedSketch = { ...sketch, constraints: [...(sketch.constraints || []), constraint] };
    addConstraint(activeSketchId, constraint); // persist + bump version
    buildSketch(updatedSketch);                // re-solve with the new constraint
    notifications.show({ color: 'blue', message: `Applied ${input.kind} constraint` });
    // The Dimension tool (SketchOperation.DIMENSION) is a two-click pick-and-create
    // gesture, not a toggleable multi-use mode like the constraint toolbar buttons —
    // once it's produced a dimension, drop back to selection instead of staying armed
    // for another pick.
    if (input.kind === 'distance' || input.kind === 'horizontal-distance' || input.kind === 'vertical-distance' || input.kind === 'point-line-distance') {
      selectOperation(null);
    }
  };

  // Remove a constraint from the active sketch and re-solve.
  const handleRemoveConstraint = (constraintId: string) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    const updatedSketch = { ...sketch, constraints: (sketch.constraints || []).filter((c: any) => c.id !== constraintId) };
    removeConstraint(activeSketchId, constraintId);
    buildSketch(updatedSketch);
  };

  // Handle constraint value update
  const handleUpdateConstraintValue = (constraintId: string, value: number) => {
    if (activeSketchId) {
      const sketch = project.sketches.find((s) => s.id === activeSketchId);
      if (sketch) {
        const updatedConstraints = sketch.constraints.map((c) => {
          if (c.id === constraintId) {
            // Update the value based on constraint type
            if ('distance' in c) return { ...c, distance: value };
            if ('difference' in c) return { ...c, difference: value };
            if ('radius' in c) return { ...c, radius: value };
            if ('angle' in c) return { ...c, angle: value };
          }
          return c;
        });
        const updatedSketch = { ...sketch, constraints: updatedConstraints };
        updateSketchState(activeSketchId, updatedSketch);
        buildSketch(updatedSketch);
      }
    }
  };

  // Pure display-metadata update (no re-solve needed) shared by the dimension-label-drag
  // and arrow-flip handlers, which otherwise differed only in what patch they applied.
  const patchVisualMetadata = (
    constraintId: string,
    patch: (meta: Sketch['visualMetadata'][string] | undefined) => Partial<Sketch['visualMetadata'][string]>,
  ) => {
    if (!activeSketchId) return;
    const sketch = project.sketches.find((s) => s.id === activeSketchId);
    if (!sketch) return;
    const meta = sketch.visualMetadata[constraintId];
    const updatedSketch = {
      ...sketch,
      visualMetadata: {
        ...sketch.visualMetadata,
        [constraintId]: { ...meta, ...patch(meta) },
      },
    };
    updateSketchState(activeSketchId, updatedSketch);
  };

  // Handle dragging a dimension label.
  const handleUpdateLabelOffset = (constraintId: string, offset: { x: number; y: number }) =>
    patchVisualMetadata(constraintId, () => ({ labelOffset: offset }));

  // Handle clicking a dimension's arrowhead — flips both arrows together between
  // pointing inward (default) and outward.
  const handleToggleArrowFlip = (constraintId: string) =>
    patchVisualMetadata(constraintId, (meta) => ({ arrowFlip: !meta?.arrowFlip }));

  return {
    applySketchElements,
    handleUpdateSketch,
    handleSelectMidpoint,
    handleRemoveSketchElement,
    handleFinishSketch,
    handleCancelSketch,
    handleApplyConstraint,
    handleRemoveConstraint,
    handleUpdateConstraintValue,
    handleUpdateLabelOffset,
    handleToggleArrowFlip,
  };
}
