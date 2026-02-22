import { SketchSolver } from './SketchSolver';
import { Sketch } from '../types/sketch/Sketch';
import { SketchPoint } from '../types/sketch/SketchPoint';
import { SketchElementType } from '../types/sketch/SketchElementType';
import { SketchConstraintType } from '../types/sketch/SketchConstraintType';
import { FixedConstraint } from '../types/sketch/constraints/FixedConstraint';
import { CoincidentConstraint } from '../types/sketch/constraints/CoincidentConstraint';
import { ParallelConstraint } from '../types/sketch/constraints/ParallelConstraint';
import { PerpendicularConstraint } from '../types/sketch/constraints/PerpendicularConstraint';
import { DistanceConstraint } from '../types/sketch/constraints/DistanceConstraint';
import { SketchLine } from '../types/sketch/SketchLine';
import { SketchCircle } from '../types/sketch/SketchCircle'; // Import SketchCircle
import { SketchArc } from '../types/sketch/SketchArc';     // Import SketchArc
import { RadiusConstraint } from '../types/sketch/constraints/RadiusConstraint'; // Import RadiusConstraint


describe('SketchSolver', () => {
  let initialSketch: Sketch;
  let point1: SketchPoint;
  let point2: SketchPoint;
  let point3: SketchPoint;
  let point4: SketchPoint; // New point for line constraints
  let point5: SketchPoint; // Center for circle
  let line1: SketchLine;
  let line2: SketchLine;
  let circle1: SketchCircle;

  beforeEach(() => {
    point1 = { id: 'p1', type: SketchElementType.POINT, x: 0, y: 0 };
    point2 = { id: 'p2', type: SketchElementType.POINT, x: 10, y: 10 };
    point3 = { id: 'p3', type: SketchElementType.POINT, x: 20, y: 20 };
    point4 = { id: 'p4', type: SketchElementType.POINT, x: 0, y: 5 };
    point5 = { id: 'p5', type: SketchElementType.POINT, x: 50, y: 50 }; // Center for circle

    line1 = { id: 'l1', type: SketchElementType.LINE, start: point1, end: point2 };
    line2 = { id: 'l2', type: SketchElementType.LINE, start: point3, end: point4 };
    circle1 = { id: 'c1', type: SketchElementType.CIRCLE, centerId: point5.id, radius: 25 };


    initialSketch = {
      id: 'sketch1',
      name: 'Test Sketch',
      plane: { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, type: 'XY' },
      elements: [line1, line2, circle1], // Include lines and circle
      points: [point1, point2, point3, point4, point5], // Include all points
      constraints: [],
      isClosed: false,
      isVisible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  it('should not change point positions if no constraints are present', () => {
    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    expect(solvedSketch.points.find((p) => p.id === 'p1')?.x).toBeCloseTo(point1.x);
    expect(solvedSketch.points.find((p) => p.id === 'p1')?.y).toBeCloseTo(point1.y);
    expect(solvedSketch.points.find((p) => p.id === 'p2')?.x).toBeCloseTo(point2.x);
    expect(solvedSketch.points.find((p) => p.id === 'p2')?.y).toBeCloseTo(point2.y);
  });

  it('should fix a point with a FixedConstraint', () => {
    const fixedConstraint: FixedConstraint = {
      id: 'f1',
      type: SketchConstraintType.FIXED,
      pointId: 'p1',
    };
    initialSketch.constraints.push(fixedConstraint);

    // Intentionally move p1 to see if it gets pulled back
    initialSketch.points.find((p) => p.id === 'p1')!.x = 5;
    initialSketch.points.find((p) => p.id === 'p1')!.y = 5;


    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedP1 = solvedSketch.points.find((p) => p.id === 'p1');
    expect(solvedP1?.x).toBeCloseTo(0); // Should be pulled back to original fixed position
    expect(solvedP1?.y).toBeCloseTo(0);
  });

  it('should make two points coincident with a CoincidentConstraint', () => {
    const coincidentConstraint: CoincidentConstraint = {
      id: 'c1',
      type: SketchConstraintType.COINCIDENT,
      point1Id: 'p1',
      point2Id: 'p2',
    };
    initialSketch.constraints.push(coincidentConstraint);

    // Initial positions: p1(0,0), p2(10,10)
    // Solver should move them to a common point, e.g., their average
    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedP1 = solvedSketch.points.find((p) => p.id === 'p1');
    const solvedP2 = solvedSketch.points.find((p) => p.id === 'p2');

    // Both should move to the midpoint (5,5) if no other constraints
    const p1 = initialSketch.points.find((p) => p.id === 'p1')!;
    const p2 = initialSketch.points.find((p) => p.id === 'p2')!;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    expect(solvedP1?.x).toBeCloseTo(midX);
    expect(solvedP1?.y).toBeCloseTo(midY);
    expect(solvedP2?.x).toBeCloseTo(midX);
    expect(solvedP2?.y).toBeCloseTo(midY);
  });

  it('should solve fixed and coincident constraints together', () => {
    const fixedConstraint: FixedConstraint = {
      id: 'f1',
      type: SketchConstraintType.FIXED,
      pointId: 'p1',
    };
    const coincidentConstraint: CoincidentConstraint = {
      id: 'c1',
      type: SketchConstraintType.COINCIDENT,
      point1Id: 'p1',
      point2Id: 'p2',
    };
    initialSketch.constraints.push(fixedConstraint, coincidentConstraint);

    // Initial positions: p1(0,0), p2(10,10)
    // p1 is fixed at (0,0). p2 should move to (0,0) to be coincident with p1.
    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedP1 = solvedSketch.points.find((p) => p.id === 'p1');
    const solvedP2 = solvedSketch.points.find((p) => p.id === 'p2');

    expect(solvedP1?.x).toBeCloseTo(0);
    expect(solvedP1?.y).toBeCloseTo(0);
    expect(solvedP2?.x).toBeCloseTo(0);
    expect(solvedP2?.y).toBeCloseTo(0);
  });

  it('should solve a chain of coincident constraints', () => {
    const c12: CoincidentConstraint = { id: 'c12', type: SketchConstraintType.COINCIDENT, point1Id: 'p1', point2Id: 'p2' };
    const c23: CoincidentConstraint = { id: 'c23', type: SketchConstraintType.COINCIDENT, point1Id: 'p2', point2Id: 'p3' };
    initialSketch.constraints.push(c12, c23);

    // Initial positions: p1(0,0), p2(10,10), p3(20,20)
    // All should move to the average (10,10)
    const p1 = initialSketch.points.find((p) => p.id === 'p1')!;
    const p2 = initialSketch.points.find((p) => p.id === 'p2')!;
    const p3 = initialSketch.points.find((p) => p.id === 'p3')!;

    const midX = (p1.x + p2.x + p3.x) / 3;
    const midY = (p1.y + p2.y + p3.y) / 3;

    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedP1 = solvedSketch.points.find((p) => p.id === 'p1');
    const solvedP2 = solvedSketch.points.find((p) => p.id === 'p2');
    const solvedP3 = solvedSketch.points.find((p) => p.id === 'p3');

    expect(solvedP1?.x).toBeCloseTo(midX);
    expect(solvedP1?.y).toBeCloseTo(midY);
    expect(solvedP2?.x).toBeCloseTo(midX);
    expect(solvedP2?.y).toBeCloseTo(midY);
    expect(solvedP3?.x).toBeCloseTo(midX);
    expect(solvedP3?.y).toBeCloseTo(midY);
  });

  it('should make two lines parallel with a ParallelConstraint', () => {
    const parallelConstraint: ParallelConstraint = {
      id: 'pa1',
      type: SketchConstraintType.PARALLEL,
      line1Id: 'l1',
      line2Id: 'l2',
    };
    const fixedConstraint: FixedConstraint = { // Fix one point to prevent free rotation
      id: 'f1',
      type: SketchConstraintType.FIXED,
      pointId: 'p1',
    };
    initialSketch.constraints.push(parallelConstraint, fixedConstraint);

    // Ensure p3 is also fixed to provide more stable test case
    initialSketch.constraints.push({ id: 'f3', type: SketchConstraintType.FIXED, pointId: 'p3' });

    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedP1 = solvedSketch.points.find((p) => p.id === 'p1');
    const solvedP2 = solvedSketch.points.find((p) => p.id === 'p2');
    const solvedP3 = solvedSketch.points.find((p) => p.id === 'p3');
    const solvedP4 = solvedSketch.points.find((p) => p.id === 'p4');

    // Line 1: (p1x, p1y) to (p2x, p2y)
    const l1_dx = (solvedP2?.x || 0) - (solvedP1?.x || 0);
    const l1_dy = (solvedP2?.y || 0) - (solvedP1?.y || 0);

    // Line 2: (p3x, p3y) to (p4x, p4y)
    const l2_dx = (solvedP4?.x || 0) - (solvedP3?.x || 0);
    const l2_dy = (solvedP4?.y || 0) - (solvedP3?.y || 0);

    // Check cross product is near zero.
    expect(l1_dx * l2_dy - l1_dy * l2_dx).toBeCloseTo(0, 2);
  });

  it('should make two lines perpendicular with a PerpendicularConstraint', () => {
    const perpendicularConstraint: PerpendicularConstraint = {
      id: 'perp1',
      type: SketchConstraintType.PERPENDICULAR,
      line1Id: 'l1',
      line2Id: 'l2',
    };
    const fixedConstraint: FixedConstraint = {
      id: 'f1',
      type: SketchConstraintType.FIXED,
      pointId: 'p1',
    };
    initialSketch.constraints.push(perpendicularConstraint, fixedConstraint);
    initialSketch.constraints.push({ id: 'f3', type: SketchConstraintType.FIXED, pointId: 'p3' });

    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedP1 = solvedSketch.points.find((p) => p.id === 'p1');
    const solvedP2 = solvedSketch.points.find((p) => p.id === 'p2');
    const solvedP3 = solvedSketch.points.find((p) => p.id === 'p3');
    const solvedP4 = solvedSketch.points.find((p) => p.id === 'p4');

    // Line 1 vector
    const l1_dx = (solvedP2?.x || 0) - (solvedP1?.x || 0);
    const l1_dy = (solvedP2?.y || 0) - (solvedP1?.y || 0);

    // Line 2 vector
    const l2_dx = (solvedP4?.x || 0) - (solvedP3?.x || 0);
    const l2_dy = (solvedP4?.y || 0) - (solvedP3?.y || 0);

    // Expect dot product to be near zero
    expect(l1_dx * l2_dx + l1_dy * l2_dy).toBeCloseTo(0, 2);
  });

  it('should enforce a distance constraint between two points', () => {
    const distanceConstraint: DistanceConstraint = {
      id: 'd1',
      type: SketchConstraintType.DISTANCE,
      point1Id: 'p1',
      point2Id: 'p2',
      distance: 50, // Target distance
    };
    const fixedConstraint: FixedConstraint = {
      id: 'f1',
      type: SketchConstraintType.FIXED,
      pointId: 'p1',
    };
    initialSketch.constraints.push(distanceConstraint, fixedConstraint);

    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedP1 = solvedSketch.points.find((p) => p.id === 'p1');
    const solvedP2 = solvedSketch.points.find((p) => p.id === 'p2');

    expect(solvedP1?.x).toBeCloseTo(0);
    expect(solvedP1?.y).toBeCloseTo(0);

    const actualDistance = Math.sqrt(
      Math.pow((solvedP2?.x || 0) - (solvedP1?.x || 0), 2) +
      Math.pow((solvedP2?.y || 0) - (solvedP1?.y || 0), 2)
    );
    expect(actualDistance).toBeCloseTo(50, 1);
  });

  it('should enforce a radius constraint on a circle', () => {
    const radiusConstraint: RadiusConstraint = {
      id: 'r1',
      type: SketchConstraintType.RADIUS,
      elementId: 'c1', // circle1
      radius: 100, // Target radius
    };
    const fixedCenter: FixedConstraint = {
      id: 'f5',
      type: SketchConstraintType.FIXED,
      pointId: 'p5', // Fix the circle's center
    };
    initialSketch.constraints.push(radiusConstraint, fixedCenter);

    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedCircle = solvedSketch.elements.find((el) => el.id === 'c1') as SketchCircle;

    expect(solvedCircle.radius).toBeCloseTo(100, 1);
  });
});
