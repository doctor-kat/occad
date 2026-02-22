import { SketchSolver } from './SketchSolver';
import { Sketch } from '../types/sketch/Sketch';
import { SketchPoint } from '../types/sketch/SketchPoint';
import { SketchElementType } from '../types/sketch/SketchElementType';
import { SketchConstraintType } from '../types/sketch/SketchConstraintType';
import { FixedConstraint } from '../types/sketch/constraints/FixedConstraint';
import { CoincidentConstraint } from '../types/sketch/constraints/CoincidentConstraint';

describe('SketchSolver', () => {
  let initialSketch: Sketch;
  let point1: SketchPoint;
  let point2: SketchPoint;
  let point3: SketchPoint;

  beforeEach(() => {
    point1 = { id: 'p1', type: SketchElementType.POINT, x: 0, y: 0 };
    point2 = { id: 'p2', type: SketchElementType.POINT, x: 10, y: 10 };
    point3 = { id: 'p3', type: SketchElementType.POINT, x: 20, y: 20 };

    initialSketch = {
      id: 'sketch1',
      name: 'Test Sketch',
      plane: { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, type: 'XY' },
      elements: [],
      points: [point1, point2, point3],
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
});
