import { describe, it, expect } from "vitest";
import { FeatureOperation } from "@/cad/types";
import type { Feature } from "@/cad/types";
import { extrudeStrategy } from "./extrude";
import { revolveStrategy } from "./revolve";
import { booleanStrategy } from "./boolean";
import { filletStrategy } from "./modifications";
import { transformStrategy } from "./transform";
import { measureStrategy } from "./measure";
import { FEATURE_STRATEGY_REGISTRY } from "./registry";

function makeFeature(overrides: Partial<Feature>): Feature {
  return {
    id: "f1",
    name: "Feature",
    type: FeatureOperation.EXTRUDE_BOSS,
    parentIds: [],
    isSuppressed: false,
    isVisible: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as Feature;
}

const FACE = { __isFace: true, ShapeType: () => "FACE" };
const makeShape = (tag: string) => ({ tag, IsNull: () => false });

describe("extrudeStrategy", () => {
  it("resolves the direction from the face normal and produces a prism shape", () => {
    const calls: any[] = [];
    const oc: any = {
      TopoDS: { Face_1: (f: any) => f },
      BRep_Tool: { Surface_2: () => ({ get: () => ({}) }) },
      Handle_Geom_Plane_2: class {
        get() {
          return { Axis: () => ({ Direction: () => ({ X: () => 0, Y: () => 1, Z: () => 0 }) }) };
        }
      },
      TopAbs_ShapeEnum: { TopAbs_COMPOUND: "COMPOUND", TopAbs_WIRE: "WIRE" },
      gp_Vec_4: class { constructor(public x: number, public y: number, public z: number) { calls.push({ x, y, z }); } delete() {} },
      BRepPrimAPI_MakePrism_1: class {
        Shape() { return makeShape("prism"); }
        IsDone() { return true; }
        delete() {}
      },
    };
    const ctx: any = {
      oc,
      shapeStorage: new Map([["sketch_s1_1", FACE]]),
    };
    const feature = makeFeature({
      type: FeatureOperation.EXTRUDE_BOSS,
      sketchId: "s1",
      parameters: { distance: 10, isCut: false },
    });

    const result = extrudeStrategy({ ctx, feature, currentBody: null, featureSolids: new Map(), refEnrichments: [] });

    expect(result.kind).toBe("produce");
    expect((result as any).shape.tag).toBe("prism");
    expect((result as any).combine).toBe("union");
    // Direction followed the face's +Y normal, not world +Z.
    expect(calls[0]).toEqual({ x: 0, y: 10, z: 0 });
  });

  it("throws when the source sketch shape is missing", () => {
    const ctx: any = { oc: {}, shapeStorage: new Map() };
    const feature = makeFeature({ type: FeatureOperation.EXTRUDE_BOSS, sketchId: "missing", parameters: { distance: 5 } });
    expect(() => extrudeStrategy({ ctx, feature, currentBody: null, featureSolids: new Map(), refEnrichments: [] })).toThrow(/not found/);
  });

  it("requests a subtract combine for EXTRUDED_CUT", () => {
    const oc: any = {
      TopoDS: { Face_1: (f: any) => f },
      BRep_Tool: { Surface_2: () => ({ get: () => ({}) }) },
      Handle_Geom_Plane_2: class { get() { return null; } },
      TopAbs_ShapeEnum: { TopAbs_COMPOUND: "COMPOUND", TopAbs_WIRE: "WIRE" },
      gp_Vec_4: class { constructor(public x: number, public y: number, public z: number) {} delete() {} },
      BRepPrimAPI_MakePrism_1: class { Shape() { return makeShape("prism"); } IsDone() { return true; } delete() {} },
    };
    const ctx: any = { oc, shapeStorage: new Map([["sketch_s1_1", FACE]]) };
    const feature = makeFeature({ type: FeatureOperation.EXTRUDED_CUT, sketchId: "s1", parameters: { distance: 5, isCut: true } });

    const result = extrudeStrategy({ ctx, feature, currentBody: null, featureSolids: new Map(), refEnrichments: [] });

    expect((result as any).combine).toBe("subtract");
  });
});

describe("revolveStrategy", () => {
  it("builds along the given axis and produces a shape", () => {
    const oc: any = {
      TopoDS: { Face_1: (f: any) => f },
      TopAbs_ShapeEnum: { TopAbs_COMPOUND: "COMPOUND", TopAbs_WIRE: "WIRE" },
      gp_Pnt_3: class { constructor(public x: number, public y: number, public z: number) {} delete() {} },
      gp_Dir_4: class { constructor(public x: number, public y: number, public z: number) {} delete() {} },
      gp_Ax1_2: class { constructor(public origin: any, public dir: any) {} delete() {} },
      BRepPrimAPI_MakeRevol_1: class {
        Shape() { return makeShape("revol"); }
        IsDone() { return true; }
        delete() {}
      },
    };
    const ctx: any = { oc, shapeStorage: new Map([["sketch_s1_1", FACE]]) };
    const feature = makeFeature({
      type: FeatureOperation.REVOLVED_BOSS,
      sketchId: "s1",
      parameters: { angle: 180, axis: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 } } },
    });

    const result = revolveStrategy({ ctx, feature, currentBody: null, featureSolids: new Map(), refEnrichments: [] });

    expect(result).toEqual({ kind: "produce", shape: expect.objectContaining({ tag: "revol" }), combine: "union" });
  });
});

describe("booleanStrategy", () => {
  it("requires at least two operands, otherwise leaves the body unchanged", () => {
    const ctx: any = { oc: {} };
    const currentBody = makeShape("existing");
    const feature = makeFeature({ type: FeatureOperation.UNION, parameters: { featureIds: ["only-one"] } });
    const featureSolids = new Map([["only-one", makeShape("solid1")]]);

    const result = booleanStrategy({ ctx, feature, currentBody, featureSolids, refEnrichments: [] });

    expect(result).toEqual({ kind: "noop" });
  });

  it("fuses two operands via performBooleanOperation for UNION", () => {
    // performBooleanOperation itself is exercised elsewhere; here we only need
    // a shape that survives IsNull() filtering to prove operand collection.
    const s1 = makeShape("solid1");
    const s2 = makeShape("solid2");
    const featureSolids = new Map([["a", s1], ["b", s2]]);
    const feature = makeFeature({ type: FeatureOperation.UNION, parameters: { featureIds: ["a", "b"] } });
    const ctx: any = {
      oc: {
        Message_ProgressRange_1: class { delete() {} },
        BRepAlgoAPI_Fuse_3: class {
          Shape() { return makeShape("fused"); }
          IsDone() { return true; }
          delete() {}
        },
      },
    };

    const result = booleanStrategy({ ctx, feature, currentBody: null, featureSolids, refEnrichments: [] });

    expect(result.kind).toBe("replace");
    expect((result as any).body.tag).toBe("fused");
  });
});

describe("filletStrategy", () => {
  it("is a no-op when there is no body yet", () => {
    const ctx: any = { oc: {} };
    const feature = makeFeature({ type: FeatureOperation.FILLET, parameters: { edges: [], radius: 1 } });
    const result = filletStrategy({ ctx, feature, currentBody: null, featureSolids: new Map(), refEnrichments: [] });
    expect(result).toEqual({ kind: "noop" });
  });
});

describe("transformStrategy", () => {
  it("is a no-op when there is no body yet", () => {
    const ctx: any = { oc: {} };
    const feature = makeFeature({ type: FeatureOperation.MOVE, parameters: {} });
    const result = transformStrategy({ ctx, feature, currentBody: null, featureSolids: new Map(), refEnrichments: [] });
    expect(result).toEqual({ kind: "noop" });
  });
});

describe("measureStrategy", () => {
  it("always no-ops", () => {
    const feature = makeFeature({ type: FeatureOperation.MEASURE });
    const result = measureStrategy({ ctx: {} as any, feature, currentBody: makeShape("x"), featureSolids: new Map(), refEnrichments: [] });
    expect(result).toEqual({ kind: "noop" });
  });
});

describe("FEATURE_STRATEGY_REGISTRY", () => {
  it("has an entry for every body-affecting feature operation", () => {
    const expected = [
      FeatureOperation.EXTRUDE_BOSS,
      FeatureOperation.EXTRUDED_CUT,
      FeatureOperation.REVOLVED_BOSS,
      FeatureOperation.REVOLVED_CUT,
      FeatureOperation.IMPORT,
      FeatureOperation.BOX,
      FeatureOperation.CYLINDER,
      FeatureOperation.SPHERE,
      FeatureOperation.CONE,
      FeatureOperation.TORUS,
      FeatureOperation.WEDGE,
      FeatureOperation.SWEEP,
      FeatureOperation.LOFT,
      FeatureOperation.FILLET,
      FeatureOperation.CHAMFER,
      FeatureOperation.SHELL,
      FeatureOperation.OFFSET,
      FeatureOperation.MOVE,
      FeatureOperation.ROTATE,
      FeatureOperation.MIRROR,
      FeatureOperation.SCALE,
      FeatureOperation.UNION,
      FeatureOperation.INTERSECT,
      FeatureOperation.MEASURE,
    ];
    for (const op of expected) {
      expect(FEATURE_STRATEGY_REGISTRY[op]).toBeTypeOf("function");
    }
  });
});
