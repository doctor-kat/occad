import { describe, it, expect } from 'vitest';
import { init_planegcs_module, GcsWrapper } from '@salusoft89/planegcs';
import { inferAutoConstraints } from './autoConstraints';
import { mapElementsToPrimitives, type SketchPrimitiveDTO } from './elementsToPrimitives';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';

/** Solve primitives + constraints with the REAL planegcs solver (no mocks). */
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

const rect = (id: string): SketchElement => ({
  type: SketchElementType.RECTANGLE,
  id,
  corner1: { x: 0, y: 0 },
  corner2: { x: 10, y: 6 },
});

const line: SketchElement = {
  type: SketchElementType.LINE,
  id: 'L',
  start: { x: 0, y: 0 },
  end: { x: 5, y: 5 },
};

describe('inferAutoConstraints — shape', () => {
  it('emits 2 horizontal + 2 vertical relations for a rectangle, all tagged auto', () => {
    const cs = inferAutoConstraints([rect('R')]);
    expect(cs).toHaveLength(4);
    expect(cs.every((c) => c.auto === true)).toBe(true);
    expect(cs.filter((c) => c.type === 'horizontal_l').map((c) => c.l_id).sort()).toEqual(['R_l1', 'R_l3']);
    expect(cs.filter((c) => c.type === 'vertical_l').map((c) => c.l_id).sort()).toEqual(['R_l2', 'R_l4']);
  });

  it('uses deterministic ids (idempotent across calls)', () => {
    expect(inferAutoConstraints([rect('R')]).map((c) => c.id)).toEqual(
      inferAutoConstraints([rect('R')]).map((c) => c.id),
    );
  });

  it('emits nothing for non-rectangle entities', () => {
    expect(inferAutoConstraints([line])).toEqual([]);
  });
});

describe('inferAutoConstraints — real planegcs solve', () => {
  it('pulls a skewed rectangle back to axis-aligned (edges H/V)', async () => {
    // Start from the real mapping, then skew two corners so no edge is axis-aligned.
    const prims = mapElementsToPrimitives([rect('R')]).map((p) => {
      if (p.id === 'R_p1') return { ...p, fixed: true }; // anchor so the solve is determinate
      if (p.id === 'R_p2') return { ...p, data: { x: 10, y: 2 } }; // bottom edge no longer horizontal
      if (p.id === 'R_p4') return { ...p, data: { x: 3, y: 6 } };  // left edge no longer vertical
      return p;
    });

    const { status, byId } = await solve(prims, inferAutoConstraints([rect('R')]));

    expect(status).toBe(0);
    // l1 (p1→p2) horizontal, l3 (p3→p4) horizontal
    expect(byId.R_p2.y).toBeCloseTo(byId.R_p1.y, 4);
    expect(byId.R_p3.y).toBeCloseTo(byId.R_p4.y, 4);
    // l2 (p2→p3) vertical, l4 (p4→p1) vertical
    expect(byId.R_p3.x).toBeCloseTo(byId.R_p2.x, 4);
    expect(byId.R_p4.x).toBeCloseTo(byId.R_p1.x, 4);
  });
});
