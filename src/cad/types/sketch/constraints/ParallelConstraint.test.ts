import { ParallelConstraint } from './ParallelConstraint';
import { SketchConstraintType } from '../SketchConstraintType';

describe('ParallelConstraint', () => {
  it('should create a ParallelConstraint with the correct properties', () => {
    const parallelConstraint: ParallelConstraint = {
      id: 'parallel1',
      type: SketchConstraintType.PARALLEL,
      line1Id: 'lineA',
      line2Id: 'lineB',
    };

    expect(parallelConstraint.id).toBe('parallel1');
    expect(parallelConstraint.type).toBe(SketchConstraintType.PARALLEL);
    expect(parallelConstraint.line1Id).toBe('lineA');
    expect(parallelConstraint.line2Id).toBe('lineB');
  });
});
