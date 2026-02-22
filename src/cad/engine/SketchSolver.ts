import { Sketch } from '@/cad/types/sketch/Sketch';
import { SketchPoint } from '@/cad/types/sketch/SketchPoint';
import { FixedConstraint } from '@/cad/types/sketch/constraints/FixedConstraint';
import { CoincidentConstraint } from '@/cad/types/sketch/constraints/CoincidentConstraint';
import { ParallelConstraint } from '@/cad/types/sketch/constraints/ParallelConstraint';
import { PerpendicularConstraint } from '@/cad/types/sketch/constraints/PerpendicularConstraint';
import { DistanceConstraint } from '@/cad/types/sketch/constraints/DistanceConstraint';
import { SketchConstraintType } from '@/cad/types/sketch/SketchConstraintType';
import { SketchLine } from '@/cad/types/sketch/SketchLine';
import { SketchElementType } from '@/cad/types/sketch/SketchElementType';

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

interface LinePoints {
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
}

export class SketchSolver {
  private sketch: Sketch;
  private pointMap: Map<string, SketchPoint>;
  private lineMap: Map<string, SketchLine>; // New: map for lines
  private variableToIndex: Map<string, number>; // Maps variableId to its index in the variables array
  private indexToVariable: string[]; // Maps index to variableId
  private variables: number[]; // Flat array of all numerical variables
  private constraints: { type: SketchConstraintType; evaluate: (variables: number[]) => ConstraintEvaluation }[];

  constructor(sketch: Sketch) {
    this.sketch = sketch;
    this.pointMap = new Map(sketch.points.map((p) => [p.id, p]));
    this.lineMap = new Map(
      sketch.elements
        .filter((el) => el.type === SketchElementType.LINE)
        .map((el) => [el.id, el as SketchLine])
    ); // Initialize lineMap
    this.variableToIndex = new Map();
    this.indexToVariable = [];
    this.variables = [];
    this.constraints = [];

    this.initializeVariables();
    this.initializeConstraints();
  }

  // Helper to get current line points from variables
  private getLinePoints(lineId: string, currentVariables: number[]): LinePoints {
    const line = this.lineMap.get(lineId);
    if (!line) {
      throw new Error(`Line ${lineId} not found.`);
    }

    const p1xIndex = this.getVariableIndex(`${line.start.id}_x`);
    const p1yIndex = this.getVariableIndex(`${line.start.id}_y`);
    const p2xIndex = this.getVariableIndex(`${line.end.id}_x`);
    const p2yIndex = this.getVariableIndex(`${line.end.id}_y`);

    return {
      p1x: currentVariables[p1xIndex],
      p1y: currentVariables[p1yIndex],
      p2x: currentVariables[p2xIndex],
      p2y: currentVariables[p2yIndex],
    };
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
        case SketchConstraintType.PARALLEL:
          this.constraints.push({
            type: SketchConstraintType.PARALLEL,
            evaluate: (currentVariables) =>
              this.evaluateParallelConstraint(constraint as ParallelConstraint, currentVariables),
          });
          break;
        case SketchConstraintType.PERPENDICULAR:
          this.constraints.push({
            type: SketchConstraintType.PERPENDICULAR,
            evaluate: (currentVariables) =>
              this.evaluatePerpendicularConstraint(constraint as PerpendicularConstraint, currentVariables),
          });
          break;
        case SketchConstraintType.DISTANCE:
          this.constraints.push({
            type: SketchConstraintType.DISTANCE,
            evaluate: (currentVariables) =>
              this.evaluateDistanceConstraint(constraint as DistanceConstraint, currentVariables),
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

  private evaluateParallelConstraint(
    constraint: ParallelConstraint,
    currentVariables: number[]
  ): ConstraintEvaluation {
    const line1 = this.getLinePoints(constraint.line1Id, currentVariables);
    const line2 = this.getLinePoints(constraint.line2Id, currentVariables);

    const dx1 = line1.p2x - line1.p1x;
    const dy1 = line1.p2y - line1.p1y;
    const dx2 = line2.p2x - line2.p1x;
    const dy2 = line2.p2y - line2.p1y;

    // Error is the squared 2D cross product: (dx1 * dy2 - dy1 * dx2)^2
    // If cross product is 0, lines are parallel.
    const crossProduct = dx1 * dy2 - dy1 * dx2;
    const error = crossProduct * crossProduct;

    const gradient: { [variableId: string]: number } = {};
    const errorTerm = 2 * crossProduct;

    const line1Start = this.lineMap.get(constraint.line1Id)?.start;
    const line1End = this.lineMap.get(constraint.line1Id)?.end;
    const line2Start = this.lineMap.get(constraint.line2Id)?.start;
    const line2End = this.lineMap.get(constraint.line2Id)?.end;

    if (line1Start) {
      gradient[`${line1Start.id}_x`] = -dy2 * errorTerm;
      gradient[`${line1Start.id}_y`] = dx2 * errorTerm;
    }
    if (line1End) {
      gradient[`${line1End.id}_x`] = dy2 * errorTerm;
      gradient[`${line1End.id}_y`] = -dx2 * errorTerm;
    }

    if (line2Start) {
      gradient[`${line2Start.id}_x`] = dy1 * errorTerm;
      gradient[`${line2Start.id}_y`] = -dx1 * errorTerm;
    }
    if (line2End) {
      gradient[`${line2End.id}_x`] = -dy1 * errorTerm;
      gradient[`${line2End.id}_y`] = dx1 * errorTerm;
    }


    return { error, gradient };
  }

  private evaluatePerpendicularConstraint(
    constraint: PerpendicularConstraint,
    currentVariables: number[]
  ): ConstraintEvaluation {
    const line1 = this.getLinePoints(constraint.line1Id, currentVariables);
    const line2 = this.getLinePoints(constraint.line2Id, currentVariables);

    const dx1 = line1.p2x - line1.p1x;
    const dy1 = line1.p2y - line1.p1y;
    const dx2 = line2.p2x - line2.p1x;
    const dy2 = line2.p2y - line2.p1y;

    // Error is the squared dot product: (dx1 * dx2 + dy1 * dy2)^2
    // If dot product is 0, lines are perpendicular.
    const dotProduct = dx1 * dx2 + dy1 * dy2;
    const error = dotProduct * dotProduct;

    const gradient: { [variableId: string]: number } = {};
    const errorTerm = 2 * dotProduct;

    const line1Start = this.lineMap.get(constraint.line1Id)?.start;
    const line1End = this.lineMap.get(constraint.line1Id)?.end;
    const line2Start = this.lineMap.get(constraint.line2Id)?.start;
    const line2End = this.lineMap.get(constraint.line2Id)?.end;

    // d/dp1x1 = -(dx2 * errorTerm)
    if (line1Start) {
      gradient[`${line1Start.id}_x`] = -dx2 * errorTerm;
      gradient[`${line1Start.id}_y`] = -dy2 * errorTerm;
    }
    if (line1End) {
      gradient[`${line1End.id}_x`] = dx2 * errorTerm;
      gradient[`${line1End.id}_y`] = dy2 * errorTerm;
    }

    if (line2Start) {
      gradient[`${line2Start.id}_x`] = -dx1 * errorTerm;
      gradient[`${line2Start.id}_y`] = -dy1 * errorTerm;
    }
    if (line2End) {
      gradient[`${line2End.id}_x`] = dx1 * errorTerm;
      gradient[`${line2End.id}_y`] = dy1 * errorTerm;
    }

    return { error, gradient };
  }

  private evaluateDistanceConstraint(
    constraint: DistanceConstraint,
    currentVariables: number[]
  ): ConstraintEvaluation {
    const p1xIndex = this.getVariableIndex(`${constraint.point1Id}_x`);
    const p1yIndex = this.getVariableIndex(`${constraint.point1Id}_y`);
    const p2xIndex = this.getVariableIndex(`${constraint.point2Id}_x`);
    const p2yIndex = this.getVariableIndex(`${constraint.point2Id}_y`);

    const p1x = currentVariables[p1xIndex];
    const p1y = currentVariables[p1yIndex];
    const p2x = currentVariables[p2xIndex];
    const p2y = currentVariables[p2yIndex];

    const dx = p1x - p2x;
    const dy = p1y - p2y;

    const currentDistanceSq = dx * dx + dy * dy;
    const currentDistance = Math.sqrt(currentDistanceSq);

    // Error is (currentDistance - targetDistance)^2
    const error = (currentDistance - constraint.distance) * (currentDistance - constraint.distance);

    const gradient: { [variableId: string]: number } = {};
    // Chain rule: d(error)/dx = 2 * (currentDistance - targetDistance) * d(currentDistance)/dx
    // d(currentDistance)/dx = d(sqrt(dx^2 + dy^2))/dx
    // d(currentDistance)/dx = (1/2) * (dx^2 + dy^2)^(-1/2) * 2 * dx = dx / currentDistance
    if (currentDistance > 1e-9) { // Avoid division by zero if points are coincident
        const commonFactor = 2 * (currentDistance - constraint.distance) / currentDistance;

        gradient[`${constraint.point1Id}_x`] = commonFactor * dx;
        gradient[`${constraint.point1Id}_y`] = commonFactor * dy;
        gradient[`${constraint.point2Id}_x`] = commonFactor * (-dx);
        gradient[`${constraint.point2Id}_y`] = commonFactor * (-dy);
    } else { // If points are very close, gradient is essentially zero for distance
      gradient[`${constraint.point1Id}_x`] = 0;
      gradient[`${constraint.point1Id}_y`] = 0;
      gradient[`${constraint.point2Id}_x`] = 0;
      gradient[`${constraint.point2Id}_y`] = 0;
    }


    return { error, gradient };
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
