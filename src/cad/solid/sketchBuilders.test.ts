import { describe, it, expect, vi } from 'vitest';
import { translatePrimitivesToOCC, buildSketchWire } from './sketchBuilders';
import { Sketch, Workplane, PlaneType } from '../types';

// Mock the OpenCascade and planegcs modules
vi.mock('opencascade.js', async () => {
  const actual = await vi.importActual('opencascade.js');
  return {
    ...actual,
    BRepBuilderAPI_MakeEdge_3: vi.fn(() => ({ IsDone: () => true, Edge: () => ({}) })),
    BRepBuilderAPI_MakeVertex: vi.fn(() => ({ Vertex: () => ({}) })),
  };
});

const mockWorkplane: Workplane = {
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
};

const mockCtx: any = {
  oc: {
    gp_Pnt_3: vi.fn((x, y, z) => ({ X: () => x, Y: () => y, Z: () => z, delete: vi.fn() })),
    BRepBuilderAPI_MakeEdge_3: vi.fn(() => ({ IsDone: () => true, Edge: () => ({ ShapeType: () => 1 }), delete: vi.fn() })),
    BRepBuilderAPI_MakeVertex: vi.fn(() => ({ IsDone: () => true, Vertex: () => ({ ShapeType: () => 0 }), delete: vi.fn() })),
    BRepBuilderAPI_MakeWire_1: vi.fn(() => ({ Add_1: vi.fn(), IsDone: () => true, Wire: () => ({}), delete: vi.fn() })),
    // circle construction
    gp_Dir_4: vi.fn(() => ({ delete: vi.fn() })),
    gp_Ax2_3: vi.fn(() => ({ delete: vi.fn() })),
    gp_Circ_2: vi.fn(() => ({ delete: vi.fn() })),
    BRepBuilderAPI_MakeEdge_8: vi.fn(() => ({ IsDone: () => true, Edge: () => ({ ShapeType: () => 1 }), delete: vi.fn() })),
    TopoDS: { Edge_1: vi.fn(s => s) },
    TopAbs_ShapeEnum: { TopAbs_EDGE: 1, TopAbs_VERTEX: 0, TopAbs_WIRE: 5, TopAbs_COMPOUND: 6 },
    // Compound building (used when a sketch has multiple disjoint profiles)
    TopoDS_Compound: vi.fn(() => ({ ShapeType: () => 6 })),
    BRep_Builder: vi.fn(() => ({ MakeCompound: vi.fn(), Add: vi.fn(), delete: vi.fn() })),
  }
};

describe('sketchBuilders', () => {
  it('translatePrimitivesToOCC should process points and lines', () => {
    const sketch: Sketch = {
      id: 's1', name: 'test', workplane: mockWorkplane,
      primitives: [
        { id: 'p1', type: 'point', fixed: false, data: { x: 0, y: 0 } },
        { id: 'p2', type: 'point', fixed: false, data: { x: 10, y: 10 } },
        { id: 'l1', type: 'line', fixed: false, data: { p1_id: 'p1', p2_id: 'p2' } }
      ],
      constraints: [], visualMetadata: {}, isClosed: false, isVisible: true, createdAt: 0, updatedAt: 0, elements: []
    };

    const shapes = translatePrimitivesToOCC(mockCtx, sketch);
    expect(shapes.size).toBe(3);
    expect(mockCtx.oc.BRepBuilderAPI_MakeVertex).toHaveBeenCalledTimes(2);
    expect(mockCtx.oc.BRepBuilderAPI_MakeEdge_3).toHaveBeenCalledTimes(1);
  });

  it('translates a circle that references its center via planegcs `c_id`', () => {
    const sketch: Sketch = {
      id: 's1', name: 'test', workplane: mockWorkplane,
      primitives: [
        { id: 'c0', type: 'point', fixed: false, data: { x: 0, y: 0 } },
        { id: 'C', type: 'circle', fixed: false, data: { c_id: 'c0', radius: 5 } },
      ],
      constraints: [], visualMetadata: {}, isClosed: false, isVisible: true, createdAt: 0, updatedAt: 0, elements: []
    };

    const shapes = translatePrimitivesToOCC(mockCtx, sketch);
    expect(shapes.has('C')).toBe(true);
    expect(mockCtx.oc.gp_Circ_2).toHaveBeenCalled();
  });

  it('still translates a circle that uses the legacy `center_id` key', () => {
    const sketch: Sketch = {
      id: 's1', name: 'test', workplane: mockWorkplane,
      primitives: [
        { id: 'c0', type: 'point', fixed: false, data: { x: 0, y: 0 } },
        { id: 'C', type: 'circle', fixed: false, data: { center_id: 'c0', radius: 5 } },
      ],
      constraints: [], visualMetadata: {}, isClosed: false, isVisible: true, createdAt: 0, updatedAt: 0, elements: []
    };

    const shapes = translatePrimitivesToOCC(mockCtx, sketch);
    expect(shapes.has('C')).toBe(true);
  });

  it('buildSketchWire should build a wire from primitives', () => {
    const sketch: Sketch = {
      id: 's1', name: 'test', workplane: mockWorkplane,
      primitives: [
        { id: 'p1', type: 'point', fixed: false, data: { x: 0, y: 0 } },
        { id: 'p2', type: 'point', fixed: false, data: { x: 10, y: 10 } },
        { id: 'l1', type: 'line', fixed: false, data: { p1_id: 'p1', p2_id: 'p2' } }
      ],
      constraints: [], visualMetadata: {}, isClosed: false, isVisible: true, createdAt: 0, updatedAt: 0, elements: []
    };
    
    buildSketchWire(mockCtx, sketch);
    expect(mockCtx.oc.BRepBuilderAPI_MakeWire_1).toHaveBeenCalled();
  });

  it('buildSketchWire builds one wire per disjoint profile and returns a compound', () => {
    // Two separate line loops with no shared point ids → two connected components.
    const sketch: Sketch = {
      id: 's1', name: 'test', workplane: mockWorkplane,
      primitives: [
        { id: 'a1', type: 'point', fixed: false, data: { x: 0, y: 0 } },
        { id: 'a2', type: 'point', fixed: false, data: { x: 1, y: 0 } },
        { id: 'la', type: 'line', fixed: false, data: { p1_id: 'a1', p2_id: 'a2' } },
        { id: 'b1', type: 'point', fixed: false, data: { x: 5, y: 5 } },
        { id: 'b2', type: 'point', fixed: false, data: { x: 6, y: 5 } },
        { id: 'lb', type: 'line', fixed: false, data: { p1_id: 'b1', p2_id: 'b2' } },
      ],
      constraints: [], visualMetadata: {}, isClosed: false, isVisible: true, createdAt: 0, updatedAt: 0, elements: []
    };

    mockCtx.oc.BRepBuilderAPI_MakeWire_1.mockClear();
    mockCtx.oc.TopoDS_Compound.mockClear();
    const builderInstances: any[] = [];
    mockCtx.oc.BRep_Builder.mockImplementation(() => {
      const inst = { MakeCompound: vi.fn(), Add: vi.fn(), delete: vi.fn() };
      builderInstances.push(inst);
      return inst;
    });

    const result = buildSketchWire(mockCtx, sketch);
    // A wire per component, then a compound aggregating them.
    expect(mockCtx.oc.BRepBuilderAPI_MakeWire_1).toHaveBeenCalledTimes(2);
    expect(mockCtx.oc.TopoDS_Compound).toHaveBeenCalled();
    expect(builderInstances[builderInstances.length - 1].Add).toHaveBeenCalledTimes(2);
    expect((result as any).ShapeType()).toBe(6); // TopAbs_COMPOUND
  });
});
