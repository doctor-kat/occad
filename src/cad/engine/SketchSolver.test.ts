import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SketchSolver } from './SketchSolver';
import { Sketch, Workplane, PlaneType } from '../types';

// Mock the planegcs module
vi.mock('@salusoft89/planegcs', () => {
  return {
    init_planegcs_module: vi.fn().mockResolvedValue({
      GcsSystem: class {
        delete = vi.fn();
      }
    }),
    GcsWrapper: class {
      add_primitives = vi.fn();
      solve = vi.fn().mockReturnValue(true);
      get_primitives = vi.fn().mockReturnValue([]);
      get_dof = vi.fn().mockReturnValue(0);
      get_conflicting = vi.fn().mockReturnValue([]);
      get_redundant = vi.fn().mockReturnValue([]);
      destroy_gcs_module = vi.fn();
    }
  };
});

describe('SketchSolver', () => {
  let sketch: Sketch;
  const workplane: Workplane = {
    origin: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    xAxis: { x: 1, y: 0, z: 0 },
    yAxis: { x: 0, y: 1, z: 0 }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2020, 1, 1));
    sketch = {
      id: 'sketch1',
      name: 'Test Sketch',
      workplane,
      primitives: [
        { id: 'p1', type: 'point', fixed: true, data: { x: 0, y: 0 } },
        { id: 'p2', type: 'point', fixed: false, data: { x: 10, y: 10 } }
      ],
      constraints: [
        { id: 'c1', type: 'p2p_distance', p1_id: 'p1', p2_id: 'p2', distance: 20 }
      ],
      visualMetadata: {},
      isClosed: false,
      isVisible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      elements: []
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call planegcs solver and update timestamp', async () => {
    const solver = new SketchSolver();
    vi.advanceTimersByTime(1000); // Advance time to check timestamp update
    const result = await solver.solve(sketch);
    
    expect(result.id).toBe(sketch.id);
    expect(result.updatedAt).toBeGreaterThan(sketch.updatedAt);
  });
});
