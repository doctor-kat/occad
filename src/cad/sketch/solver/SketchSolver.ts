import { init_planegcs_module, GcsWrapper } from '@salusoft89/planegcs';
import { Sketch, SketchVisualMetadata } from '@/cad/types';

/**
 * Parametric sketch solver using planegcs.
 * This runs in the Web Worker.
 */
export class SketchSolver {
  private static mod: any = null;

  /** Initialize the planegcs WASM module */
  public static async init(): Promise<void> {
    if (!this.mod) {
      this.mod = await init_planegcs_module();
    }
  }

  /**
   * Solve the sketch constraints using planegcs.
   * @param sketch The sketch state to solve
   * @returns Updated sketch state with solved coordinates and DOF data
   */
  public async solve(sketch: Sketch): Promise<Sketch> {
    await SketchSolver.init();

    // Create a new solver instance
    const system = new SketchSolver.mod.GcsSystem();
    const wrapper = new GcsWrapper(system);

    try {
      // 1. Prepare primitives for planegcs — combine geometry and constraints
      const planegcsPrimitives = sketch.primitives.map(p => ({
        ...p.data,
        id: p.id,
        type: p.type,
        fixed: p.fixed,
      }));

      // 2. Add primitives and constraints to the solver using the correct API
      wrapper.push_primitives_and_params([...planegcsPrimitives, ...sketch.constraints]);

      // 3. Run the solver
      const solveStatus = wrapper.solve();
      if (solveStatus !== 0) {
        console.warn('[SketchSolver] Solve did not fully converge, status:', solveStatus);
      }

      // 4. Apply solution back into the wrapper's sketch_index
      wrapper.apply_solution();

      // 5. Extract solved values from sketch_index
      const solvedPrimitives = wrapper.sketch_index.get_primitives();

      // 6. Compute DOF (gcs.dof() if available, else 0)
      const dof: number = typeof system.dof === 'function' ? system.dof() : 0;

      // 7. Get conflict info using the correct method names
      const conflicting: string[] = wrapper.get_gcs_conflicting_constraints();
      const redundant: string[] = wrapper.get_gcs_redundant_constraints();

      // 8. Apply solution back to the sketch state
      const newPrimitives = sketch.primitives.map(p => {
        const solved = solvedPrimitives.find((sp: any) => sp.id === p.id);
        if (solved) {
          return { ...p, data: solved };
        }
        return p;
      });

      // 9. Update visual metadata for constraints
      const newVisualMetadata: Record<string, SketchVisualMetadata> = { ...sketch.visualMetadata };

      // Clear old conflict states
      for (const id in newVisualMetadata) {
        newVisualMetadata[id] = { ...newVisualMetadata[id], conflictState: 'none' };
      }

      // Set new conflict states
      for (const id of conflicting) {
        newVisualMetadata[id] = {
          ...newVisualMetadata[id],
          conflictState: 'conflicting',
          isDriving: true,
        };
      }
      for (const id of redundant) {
        newVisualMetadata[id] = {
          ...newVisualMetadata[id],
          conflictState: 'redundant',
        };
      }

      return {
        ...sketch,
        primitives: newPrimitives,
        dof,
        visualMetadata: newVisualMetadata,
        updatedAt: Date.now(),
      };
    } catch (err) {
      console.error('[SketchSolver] Error during solve:', err);
      return sketch;
    } finally {
      // Clean up WASM memory
      try {
        wrapper.destroy_gcs_module();
      } catch (_) {
        // destroy_gcs_module already calls gcs.delete(); ignore double-delete errors
      }
    }
  }
}
