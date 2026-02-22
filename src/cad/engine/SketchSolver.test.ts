import { SketchSolver } from './SketchSolver';
import { Sketch } from '../types/sketch/Sketch';
import { SketchPoint } from '../types/sketch/SketchPoint';
import { SketchElementType } from '../types/sketch/SketchElementType';
import { SketchConstraintType } from '../types/sketch/SketchConstraintType';
import { FixedConstraint } from '../types/sketch/constraints/FixedConstraint';
import { CoincidentConstraint } from '../types/sketch/constraints/CoincidentConstraint';
import { ParallelConstraint } from '../types/sketch/constraints/ParallelConstraint'; // New import
import { PerpendicularConstraint } from '../types/sketch/constraints/PerpendicularConstraint'; // New import
import { DistanceConstraint } from '../types/sketch/constraints/DistanceConstraint'; // New import
import { SketchLine } from '../types/sketch/SketchLine'; // Import SketchLine

describe('SketchSolver', () => {
  let initialSketch: Sketch;
  let point1: SketchPoint;
  let point2: SketchPoint;
  let point3: SketchPoint;
  let point4: SketchPoint; // New point for line constraints
  let line1: SketchLine;    // New line for line constraints
  let line2: SketchLine;    // New line for line constraints

  beforeEach(() => {
    point1 = { id: 'p1', type: SketchElementType.POINT, x: 0, y: 0 };
    point2 = { id: 'p2', type: SketchElementType.POINT, x: 10, y: 10 };
    point3 = { id: 'p3', type: SketchElementType.POINT, x: 20, y: 20 };
    point4 = { id: 'p4', type: SketchElementType.POINT, x: 0, y: 5 }; // For line constraints

    line1 = { id: 'l1', type: SketchElementType.LINE, start: point1, end: point2 };
    line2 = { id: 'l2', type: SketchElementType.LINE, start: point3, end: point4 }; // Using new points

    initialSketch = {
      id: 'sketch1',
      name: 'Test Sketch',
      plane: { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, type: 'XY' },
      elements: [line1, line2], // Include lines
      points: [point1, point2, point3, point4], // Include all points
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

    expect(solvedSketch.points[0].x).toBeCloseTo(point1.x);
    expect(solvedSketch.points[0].y).toBeCloseTo(point1.y);
    expect(solvedSketch.points[1].x).toBeCloseTo(point2.x);
    expect(solvedSketch.points[1].y).toBeCloseTo(point2.y);
  });

  it('should fix a point with a FixedConstraint', () => {
    const fixedConstraint: FixedConstraint = {
      id: 'f1',
      type: SketchConstraintType.FIXED,
      pointId: 'p1',
    };
    initialSketch.constraints.push(fixedConstraint);

    // Intentionally move p1 to see if it gets pulled back
    point1.x = 5;
    point1.y = 5;

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
    const midX = (point1.x + point2.x) / 2;
    const midY = (point1.y + point2.y) / 2;

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
    const midX = (point1.x + point2.x + point3.x) / 3;
    const midY = (point1.y + point2.y + point3.y) / 3;

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

    // Initial: l1 (0,0)-(10,10), l2 (20,20)-(0,5)
    // l1 has slope 1. l2 has slope (5-20)/(0-20) = -15/-20 = 0.75
    // After parallel constraint, both should have slope 1 (from p1 fixed)
    // We expect l2 to adjust its points to become parallel to l1.
    // p1 (0,0) fixed
    // p2 will stay on y=x.
    // p3 and p4 will adjust.
    // Let's make it simpler. Fix point1 (0,0) and point3 (20,20).
    // Then l1 is (0,0)-(10,10). Slope 1.
    // l2 is (20,20)-(0,5). Slope 0.75.
    // Solver should make l2 slope 1.
    // If p3 is (20,20) and p4 is (x,y), then (y-20)/(x-20) should be 1. y-20 = x-20 => y=x.
    // So p4 should be (20-offset, 20-offset) or (20+offset, 20+offset)

    initialSketch.constraints.push({ id: 'f3', type: SketchConstraintType.FIXED, pointId: 'p3' });

    const solver = new SketchSolver(initialSketch);
    const solvedSketch = solver.solve();

    const solvedP1 = solvedSketch.points.find((p) => p.id === 'p1'); // 0,0
    const solvedP2 = solvedSketch.points.find((p) => p.id === 'p2'); // 10,10 (should be free, moved by l1 constraint)
    const solvedP3 = solvedSketch.points.find((p) => p.id === 'p3'); // 20,20
    const solvedP4 = solvedSketch.points.find((p) => p.id === 'p4'); // 0,5

    // Line 1: (p1x, p1y) to (p2x, p2y)
    const l1_dx = (solvedP2?.x || 0) - (solvedP1?.x || 0);
    const l1_dy = (solvedP2?.y || 0) - (solvedP1?.y || 0);

    // Line 2: (p3x, p3y) to (p4x, p4y)
    const l2_dx = (solvedP4?.x || 0) - (solvedP3?.x || 0);
    const l2_dy = (solvedP4?.y || 0) - (solvedP3?.y || 0);

    // Expect slopes to be close
    const slope1 = l1_dy / l1_dx;
    const slope2 = l2_dy / l2_dx;

    // Due to the basic gradient solver, it might not be perfect.
    // Check cross product is near zero.
    expect(l1_dx * l2_dy - l1_dy * l2_dx).toBeCloseTo(0, 2); // Increased precision tolerance for test
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

    // Initial: l1 (0,0)-(10,10) (slope 1), l2 (20,20)-(0,5) (slope 0.75)
    // After perpendicular constraint, slopes should be negative reciprocals.
    // If l1 slope is 1, l2 slope should be -1.
    // If p3 is fixed at (20,20), then p4 (x,y) must satisfy (y-20)/(x-20) = -1 => y-20 = -(x-20) => y = -x + 40
    // So if l1 slope is 1, and p3=(20,20), p4 could be (10,30) or (30,10) for example.

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
    expect(l1_dx * l2_dx + l1_dy * l2_dy).toBeCloseTo(0, 2); // Increased precision tolerance
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

    // Initial: p1(0,0), p2(10,10). Initial distance is sqrt(10^2+10^2) = sqrt(200) ~= 14.14
    // Target distance is 50.
    // p1 fixed at (0,0). p2 should move to (x,y) such that x^2+y^2 = 50^2 = 2500
    // e.g., (50,0) or (0,50) or (35.35, 35.35)
    // Since p2 is (10,10), it should move proportionally outward to preserve direction.
    // (10,10) scaled by 50/14.14 ~= 3.535 is (35.35, 35.35)

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
    expect(actualDistance).toBeCloseTo(50, 1); // Allow some tolerance for basic solver
  });
});
