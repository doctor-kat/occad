import { init_planegcs_module, GcsWrapper } from '@salusoft89/planegcs';
import { Sketch, SketchPrimitive, SketchVisualMetadata } from '../types';

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
      // 1. Prepare primitives for planegcs
      // We combine primitives and external geometry into the solver
      const planegcsPrimitives = sketch.primitives.map(p => ({
        ...p.data,
        id: p.id,
        type: p.type,
        fixed: p.fixed
      }));

      // 2. Add primitives and constraints to the solver
      wrapper.add_primitives(planegcsPrimitives);
      wrapper.add_primitives(sketch.constraints);

      // 3. Run the solver
      const result = wrapper.solve();
      if (!result) {
        console.warn('[SketchSolver] Solve failed to converge completely');
      }

      // 4. Extract solved values
      const solvedPrimitives = wrapper.get_primitives();
      const dof = wrapper.get_dof();
      const conflicting = wrapper.get_conflicting();
      const redundant = wrapper.get_redundant();

      // 5. Apply solution back to the sketch state
      const newPrimitives = sketch.primitives.map(p => {
        const solved = solvedPrimitives.find((sp: any) => sp.id === p.id);
        if (solved) {
          // Update the primitive's numerical data with solved values
          return { ...p, data: solved };
        }
        return p;
      });

      // 6. Update visual metadata for constraints
      const newVisualMetadata = { ...sketch.visualMetadata };
      
      // Clear old conflict states
      for (const id in newVisualMetadata) {
        newVisualMetadata[id] = { ...newVisualMetadata[id], conflictState: 'none' };
      }

      // Set new conflict states
      for (const id of conflicting) {
        newVisualMetadata[id] = { 
          ...newVisualMetadata[id], 
          conflictState: 'conflicting',
          isDriving: true // Conflicting dimensions are usually driving
        };
      }
      for (const id of redundant) {
        newVisualMetadata[id] = { 
          ...newVisualMetadata[id], 
          conflictState: 'redundant'
        };
      }

      return {
        ...sketch,
        primitives: newPrimitives,
        dof,
        visualMetadata: newVisualMetadata,
        updatedAt: Date.now()
      };
    } catch (err) {
      console.error('[SketchSolver] Error during solve:', err);
      return sketch;
    } finally {
      // Clean up WASM memory
      wrapper.destroy_gcs_module();
      if (system && typeof system.delete === 'function') {
        system.delete();
      }
    }
  }
}
