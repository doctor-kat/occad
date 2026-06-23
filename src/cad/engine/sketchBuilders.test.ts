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
    TopAbs_ShapeEnum: { TopAbs_EDGE: 1, TopAbs_VERTEX: 0 }
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
});
