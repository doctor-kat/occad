import { describe, it, expect } from 'vitest';
import { init_planegcs_module, GcsWrapper } from '@salusoft89/planegcs';
import { createConstraint, CONSTRAINT_ARITY } from './constraintFactory';
import type { SketchPrimitiveDTO } from './elementsToPrimitives';

/**
 * Solve primitives + constraints with the REAL planegcs solver (no mocks).
 * Mirrors `SketchSolver.solve` so these tests exercise the production path.
 */
async function solve(
  primitives: SketchPrimitiveDTO[],
  constraints: Record<string, any>[],
): Promise<{ status: number; byId: Record<string, any> }> {
  const mod = await init_planegcs_module();
  const system = new mod.GcsSystem();
  const wrapper = new GcsWrapper(system);
  try {
    const planegcsPrims = primitives.map((p) => ({ ...p.data, id: p.id, type: p.type, fixed: p.fixed }));
    wrapper.push_primitives_and_params([...planegcsPrims, ...constraints] as any);
    const status = wrapper.solve();
    wrapper.apply_solution();
    const solved: any[] = wrapper.sketch_index.get_primitives();
    const byId: Record<string, any> = {};
    for (const s of solved) byId[s.id] = s;
    return { status, byId };
  } finally {
    wrapper.destroy_gcs_module();
  }
}

const pt = (id: string, x: number, y: number, fixed = false): SketchPrimitiveDTO => ({
  id, type: 'point', fixed, data: { x, y },
});
const line = (id: string, p1: string, p2: string): SketchPrimitiveDTO => ({
  id, type: 'line', fixed: false, data: { p1_id: p1, p2_id: p2 },
});
// planegcs-native circle: center point referenced via `c_id` (see gcs_wrapper.push_circle)
const circle = (id: string, center: string, radius: number): SketchPrimitiveDTO => ({
  id, type: 'circle', fixed: false, data: { c_id: center, radius },
});
const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);

describe('createConstraint — object shape', () => {
  it('produces the verified planegcs type strings', () => {
    expect(createConstraint('c', { kind: 'horizontal', lineId: 'L' })).toMatchObject({ type: 'horizontal_l', l_id: 'L' });
    expect(createConstraint('c', { kind: 'vertical', lineId: 'L' })).toMatchObject({ type: 'vertical_l', l_id: 'L' });
    expect(createConstraint('c', { kind: 'coincident', p1Id: 'a', p2Id: 'b' })).toMatchObject({ type: 'p2p_coincident' });
    expect(createConstraint('c', { kind: 'parallel', l1Id: 'a', l2Id: 'b' })).toMatchObject({ type: 'parallel' });
    expect(createConstraint('c', { kind: 'perpendicular', l1Id: 'a', l2Id: 'b' })).toMatchObject({ type: 'perpendicular_ll' });
    expect(createConstraint('c', { kind: 'distance', p1Id: 'a', p2Id: 'b', distance: 5 })).toMatchObject({ type: 'p2p_distance', distance: 5, driving: true });
    expect(createConstraint('c', { kind: 'horizontal-distance', p1Id: 'a', p2Id: 'b', distance: 5 })).toMatchObject({
      type: 'difference', param1: { o_id: 'a', prop: 'x' }, param2: { o_id: 'b', prop: 'x' }, difference: 5, driving: true,
    });
    expect(createConstraint('c', { kind: 'vertical-distance', p1Id: 'a', p2Id: 'b', distance: 5 })).toMatchObject({
      type: 'difference', param1: { o_id: 'a', prop: 'y' }, param2: { o_id: 'b', prop: 'y' }, difference: 5, driving: true,
    });
    expect(createConstraint('c', { kind: 'point-line-distance', pointId: 'a', lineId: 'L', distance: 5 })).toMatchObject({
      type: 'p2l_distance', p_id: 'a', l_id: 'L', distance: 5, driving: true,
    });
    expect(createConstraint('c', { kind: 'radius', targetId: 'C', radius: 7 })).toMatchObject({ type: 'circle_radius', c_id: 'C', radius: 7 });
    expect(createConstraint('c', { kind: 'radius', targetId: 'A', radius: 7, isArc: true })).toMatchObject({ type: 'arc_radius', a_id: 'A' });
    expect(createConstraint('c', { kind: 'equal', l1Id: 'a', l2Id: 'b' })).toMatchObject({ type: 'equal_length' });
    expect(createConstraint('c', { kind: 'tangent', lineId: 'L', circleId: 'C' })).toMatchObject({ type: 'tangent_lc' });
    expect(createConstraint('c', { kind: 'angle', l1Id: 'a', l2Id: 'b', angle: 1 })).toMatchObject({ type: 'l2l_angle_ll', angle: 1 });
  });

  it('declares arity for every kind', () => {
    expect(Object.keys(CONSTRAINT_ARITY).sort()).toEqual(
      [
        'angle', 'coincident', 'distance', 'equal', 'horizontal', 'horizontal-distance',
        'parallel', 'perpendicular', 'point-line-distance', 'radius', 'tangent', 'vertical', 'vertical-distance',
      ],
    );
  });
});

describe('createConstraint — real planegcs solve', () => {
  it('horizontal: makes a slanted line horizontal', async () => {
    const prims = [pt('p1', 0, 0, true), pt('p2', 10, 5), line('L', 'p1', 'p2')];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'horizontal', lineId: 'L' })]);
    expect(status).toBe(0);
    expect(byId.p2.y).toBeCloseTo(0, 6);
  });

  it('vertical: makes a slanted line vertical', async () => {
    const prims = [pt('p1', 0, 0, true), pt('p2', 5, 10), line('L', 'p1', 'p2')];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'vertical', lineId: 'L' })]);
    expect(status).toBe(0);
    expect(byId.p2.x).toBeCloseTo(0, 6);
  });

  it('coincident: merges two points', async () => {
    const prims = [pt('a', 0, 0, true), pt('b', 5, 5)];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'coincident', p1Id: 'a', p2Id: 'b' })]);
    expect(status).toBe(0);
    expect(byId.b.x).toBeCloseTo(0, 6);
    expect(byId.b.y).toBeCloseTo(0, 6);
  });

  it('distance: enforces point-to-point distance', async () => {
    const prims = [pt('a', 0, 0, true), pt('b', 5, 0)];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'distance', p1Id: 'a', p2Id: 'b', distance: 20 })]);
    expect(status).toBe(0);
    expect(dist(byId.a, byId.b)).toBeCloseTo(20, 4);
  });

  it('point-line-distance: enforces perpendicular distance from a point to a fixed line', async () => {
    const prims = [
      pt('l1', 0, 0, true), pt('l2', 10, 0, true), line('L', 'l1', 'l2'),
      pt('p', 3, 2),
    ];
    const { status, byId } = await solve(prims, [
      createConstraint('c', { kind: 'point-line-distance', pointId: 'p', lineId: 'L', distance: 15 }),
    ]);
    expect(status).toBe(0);
    expect(Math.abs(byId.p.y)).toBeCloseTo(15, 4); // line is horizontal (y=0); perpendicular distance is |y|
  });

  it('horizontal-distance: enforces X separation while leaving Y free', async () => {
    const prims = [pt('a', 0, 0, true), pt('b', 5, 3)];
    const { status, byId } = await solve(prims, [
      createConstraint('c', { kind: 'horizontal-distance', p1Id: 'a', p2Id: 'b', distance: 20 }),
    ]);
    expect(status).toBe(0);
    expect(Math.abs(byId.b.x - byId.a.x)).toBeCloseTo(20, 4);
    expect(byId.b.y).toBeCloseTo(3, 4); // Y untouched
  });

  it('vertical-distance: enforces Y separation while leaving X free', async () => {
    const prims = [pt('a', 0, 0, true), pt('b', 5, 3)];
    const { status, byId } = await solve(prims, [
      createConstraint('c', { kind: 'vertical-distance', p1Id: 'a', p2Id: 'b', distance: 20 }),
    ]);
    expect(status).toBe(0);
    expect(Math.abs(byId.b.y - byId.a.y)).toBeCloseTo(20, 4);
    expect(byId.b.x).toBeCloseTo(5, 4); // X untouched
  });

  it('parallel: makes a line parallel to a fixed horizontal line', async () => {
    const prims = [
      pt('p1', 0, 0, true), pt('p2', 10, 0, true), line('L1', 'p1', 'p2'),
      pt('p3', 0, 5, true), pt('p4', 10, 8), line('L2', 'p3', 'p4'),
    ];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'parallel', l1Id: 'L1', l2Id: 'L2' })]);
    expect(status).toBe(0);
    expect(byId.p4.y).toBeCloseTo(5, 4); // L2 becomes horizontal (matches L1 slope)
  });

  it('perpendicular: makes a line perpendicular to a fixed horizontal line', async () => {
    const prims = [
      pt('p1', 0, 0, true), pt('p2', 10, 0, true), line('L1', 'p1', 'p2'),
      pt('p3', 0, 0, true), pt('p4', 5, 5), line('L2', 'p3', 'p4'),
    ];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'perpendicular', l1Id: 'L1', l2Id: 'L2' })]);
    expect(status).toBe(0);
    expect(byId.p4.x).toBeCloseTo(0, 4); // L2 becomes vertical
  });

  it('radius: drives a circle radius', async () => {
    const prims = [pt('c0', 0, 0, true), circle('C', 'c0', 5)];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'radius', targetId: 'C', radius: 12 })]);
    expect(status).toBe(0);
    expect(byId.C.radius).toBeCloseTo(12, 4);
  });

  it('equal: equalizes two line lengths', async () => {
    const prims = [
      pt('p1', 0, 0, true), pt('p2', 10, 0, true), line('L1', 'p1', 'p2'), // length 10
      pt('p3', 0, 5, true), pt('p4', 4, 5), line('L2', 'p3', 'p4'),       // length 4 -> 10
    ];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'equal', l1Id: 'L1', l2Id: 'L2' })]);
    expect(status).toBe(0);
    expect(dist(byId.p3, byId.p4)).toBeCloseTo(10, 4);
  });

  it('tangent: line becomes tangent to a fixed circle (perp. distance = radius)', async () => {
    const prims = [
      pt('c0', 0, 0, true), circle('C', 'c0', 5),
      pt('p1', -10, 8), pt('p2', 10, 8), line('L', 'p1', 'p2'),
    ];
    // pin the radius (otherwise the solver can satisfy tangency by growing the circle)
    // and keep the line horizontal so the tangent solution is unambiguous (y = ±radius).
    const { status, byId } = await solve(prims, [
      createConstraint('r', { kind: 'radius', targetId: 'C', radius: 5 }),
      createConstraint('h', { kind: 'horizontal', lineId: 'L' }),
      createConstraint('t', { kind: 'tangent', lineId: 'L', circleId: 'C' }),
    ]);
    expect(status).toBe(0);
    expect(byId.C.radius).toBeCloseTo(5, 4);
    expect(byId.p1.y).toBeCloseTo(byId.p2.y, 4);   // stayed horizontal
    expect(Math.abs(byId.p1.y)).toBeCloseTo(5, 3);  // distance from center == radius
  });

  it('angle: sets the angle between two lines to 45°', async () => {
    const prims = [
      pt('p1', 0, 0, true), pt('p2', 10, 0, true), line('L1', 'p1', 'p2'),
      pt('p3', 0, 0, true), pt('p4', 10, 1), line('L2', 'p3', 'p4'),
    ];
    const { status, byId } = await solve(prims, [createConstraint('c', { kind: 'angle', l1Id: 'L1', l2Id: 'L2', angle: Math.PI / 4 })]);
    expect(status).toBe(0);
    const a1 = Math.atan2(byId.p2.y - byId.p1.y, byId.p2.x - byId.p1.x);
    const a2 = Math.atan2(byId.p4.y - byId.p3.y, byId.p4.x - byId.p3.x);
    let diff = Math.abs(a2 - a1) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    expect(diff).toBeCloseTo(Math.PI / 4, 3);
  });
});
