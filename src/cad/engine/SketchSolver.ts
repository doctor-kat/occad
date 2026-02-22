import { Sketch } from '@/cad/types/sketch/Sketch';
import { SketchPoint } from '@/cad/types/sketch/SketchPoint';
import { FixedConstraint } from '@/cad/types/sketch/constraints/FixedConstraint';
import { CoincidentConstraint } from '@/cad/types/sketch/constraints/CoincidentConstraint';
import { SketchConstraintType } from '@/cad/types/sketch/SketchConstraintType';

/**
 * Maps geometric entities to numerical variables for the solver.
 * Each point (x,y) becomes two variables.
 */
interface SolverVariableMap {
  [variableId: string]: number; // variableId could be "pointId_x" or "pointId_y"
}

interface ConstraintEvaluation {
  error: number;
  gradient: { [variableId: string]: number }; // Partial derivatives for each involved variable
}

export class SketchSolver {
  private sketch: Sketch;
  private pointMap: Map<string, SketchPoint>;
  private variableToIndex: Map<string, number>; // Maps variableId to its index in the variables array
  private indexToVariable: string[]; // Maps index to variableId
  private variables: number[]; // Flat array of all numerical variables
  private constraints: { type: SketchConstraintType; evaluate: (variables: number[]) => ConstraintEvaluation }[];

  constructor(sketch: Sketch) {
    this.sketch = sketch;
    this.pointMap = new Map(sketch.points.map((p) => [p.id, p]));
    this.variableToIndex = new Map();
    this.indexToVariable = [];
    this.variables = [];
    this.constraints = [];

    this.initializeVariables();
    this.initializeConstraints();
  }

  private initializeVariables(): void {
    let index = 0;
    for (const point of this.sketch.points) {
      this.variableToIndex.set(`${point.id}_x`, index);
      this.indexToVariable[index] = `${point.id}_x`;
      this.variables[index] = point.x;
      index++;

      this.variableToIndex.set(`${point.id}_y`, index);
      this.indexToVariable[index] = `${point.id}_y`;
      this.variables[index] = point.y;
      index++;
    }
    // Expand here for other entity types if they have parameters
  }

  private initializeConstraints(): void {
    for (const constraint of this.sketch.constraints) {
      switch (constraint.type) {
        case SketchConstraintType.FIXED:
          this.constraints.push({
            type: SketchConstraintType.FIXED,
            evaluate: (currentVariables) => this.evaluateFixedConstraint(constraint as FixedConstraint, currentVariables),
          });
          break;
        case SketchConstraintType.COINCIDENT:
          this.constraints.push({
            type: SketchConstraintType.COINCIDENT,
            evaluate: (currentVariables) =>
              this.evaluateCoincidentConstraint(constraint as CoincidentConstraint, currentVariables),
          });
          break;
        // Add other constraint types here
        default:
          console.warn(`Unknown constraint type: ${constraint.type}`);
      }
    }
  }

  private getVariableIndex(variableId: string): number {
    const index = this.variableToIndex.get(variableId);
    if (index === undefined) {
      throw new Error(`Variable ${variableId} not found in solver.`);
    }
    return index;
  }

  private evaluateFixedConstraint(
    constraint: FixedConstraint,
    currentVariables: number[]
  ): ConstraintEvaluation {
    const point = this.pointMap.get(constraint.pointId);
    if (!point) {
      return { error: 0, gradient: {} }; // Point not found, constraint has no effect
    }

    const xIndex = this.getVariableIndex(`${point.id}_x`);
    const yIndex = this.getVariableIndex(`${point.id}_y`);

    const currentX = currentVariables[xIndex];
    const currentY = currentVariables[yIndex];

    const errorX = currentX - point.x; // Error is difference from original fixed position
    const errorY = currentY - point.y;

    // Fixed constraint tries to keep the point at its original position (point.x, point.y)
    // The error is the deviation from this original position.
    // We can treat this as two separate constraints (one for x, one for y) or one combined.
    // For simplicity, we'll combine the error (sum of squares) and define its gradient.
    const combinedError = errorX * errorX + errorY * errorY;

    // Gradient: d(errorX^2 + errorY^2)/dx = 2*errorX
    //           d(errorX^2 + errorY^2)/dy = 2*errorY
    const gradient: { [variableId: string]: number } = {};
    gradient[`${point.id}_x`] = 2 * errorX;
    gradient[`${point.id}_y`] = 2 * errorY;

    return { error: combinedError, gradient };
  }

  private evaluateCoincidentConstraint(
    constraint: CoincidentConstraint,
    currentVariables: number[]
  ): ConstraintEvaluation {
    const point1 = this.pointMap.get(constraint.point1Id);
    const point2 = this.pointMap.get(constraint.point2Id);

    if (!point1 || !point2) {
      return { error: 0, gradient: {} }; // Points not found, constraint has no effect
    }

    const p1xIndex = this.getVariableIndex(`${point1.id}_x`);
    const p1yIndex = this.getVariableIndex(`${point1.id}_y`);
    const p2xIndex = this.getVariableIndex(`${point2.id}_x`);
    const p2yIndex = this.getVariableIndex(`${point2.id}_y`);

    const p1x = currentVariables[p1xIndex];
    const p1y = currentVariables[p1yIndex];
    const p2x = currentVariables[p2xIndex];
    const p2y = currentVariables[p2yIndex];

    const errorX = p1x - p2x;
    const errorY = p1y - p2y;

    const combinedError = errorX * errorX + errorY * errorY;

    // Gradient: d(errorX^2 + errorY^2)/dp1x = 2*errorX
    //           d(errorX^2 + errorY^2)/dp1y = 2*errorY
    //           d(errorX^2 + errorY^2)/dp2x = -2*errorX
    //           d(errorX^2 + errorY^2)/dp2y = -2*errorY
    const gradient: { [variableId: string]: number } = {};
    gradient[`${point1.id}_x`] = 2 * errorX;
    gradient[`${point1.id}_y`] = 2 * errorY;
    gradient[`${point2.id}_x`] = -2 * errorX;
    gradient[`${point2.id}_y`] = -2 * errorY;

    return { error: combinedError, gradient };
  }

  /**
   * Solves the sketch using a simple iterative gradient descent-like approach.
   * This is a placeholder and will be replaced by a more robust solver later.
   * @param learningRate The step size for each iteration.
   * @param iterations Maximum number of iterations.
   * @param tolerance Error tolerance for convergence.
   * @returns A new Sketch object with updated point positions.
   */
  public solve(learningRate = 0.005, iterations = 500, tolerance = 1e-6): Sketch {
    let currentVariables = [...this.variables];

    for (let i = 0; i < iterations; i++) {
      let totalError = 0;
      const totalGradient: number[] = new Array(currentVariables.length).fill(0);

      for (const constraint of this.constraints) {
        const { error, gradient } = constraint.evaluate(currentVariables);
        totalError += error;

        for (const variableId in gradient) {
          const varIndex = this.getVariableIndex(variableId);
          totalGradient[varIndex] += gradient[variableId];
        }
      }

      if (totalError < tolerance) {
        break; // Converged
      }

      // Update variables using gradient descent
      for (let j = 0; j < currentVariables.length; j++) {
        currentVariables[j] -= learningRate * totalGradient[j];
      }
    }

    // Create a new Sketch object with updated point positions
    const newPoints: SketchPoint[] = this.sketch.points.map((p) => {
      const xIndex = this.getVariableIndex(`${p.id}_x`);
      const yIndex = this.getVariableIndex(`${p.id}_y`);
      return { ...p, x: currentVariables[xIndex], y: currentVariables[yIndex] };
    });

    return { ...this.sketch, points: newPoints };
  }
}
