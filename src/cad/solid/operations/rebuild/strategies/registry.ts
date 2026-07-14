import { FeatureOperation, type Operation } from '@/cad/types';
import { extrudeStrategy } from './extrude';
import { revolveStrategy } from './revolve';
import { importStrategy } from './import';
import { primitiveStrategy } from './primitive';
import { sweepStrategy, loftStrategy } from './sweepLoft';
import { filletStrategy, chamferStrategy, shellStrategy, offsetStrategy } from './modifications';
import { transformStrategy } from './transform';
import { booleanStrategy } from './boolean';
import { measureStrategy } from './measure';
import type { FeatureStrategy } from './types';

/**
 * Registry-factory: maps a feature type to its rebuild strategy. Mirrors
 * OPERATION_PANEL_REGISTRY (UI) and drawTools/registry.ts (sketch engine).
 * Every body-affecting FeatureOperation must have an entry — handleRebuild
 * throws loudly for anything missing rather than silently dropping it.
 */
export const FEATURE_STRATEGY_REGISTRY: Partial<Record<Operation, FeatureStrategy>> = {
  [FeatureOperation.EXTRUDE_BOSS]: extrudeStrategy,
  [FeatureOperation.EXTRUDED_CUT]: extrudeStrategy,
  [FeatureOperation.REVOLVED_BOSS]: revolveStrategy,
  [FeatureOperation.REVOLVED_CUT]: revolveStrategy,
  [FeatureOperation.IMPORT]: importStrategy,
  [FeatureOperation.BOX]: primitiveStrategy,
  [FeatureOperation.CYLINDER]: primitiveStrategy,
  [FeatureOperation.SPHERE]: primitiveStrategy,
  [FeatureOperation.CONE]: primitiveStrategy,
  [FeatureOperation.TORUS]: primitiveStrategy,
  [FeatureOperation.WEDGE]: primitiveStrategy,
  [FeatureOperation.SWEEP]: sweepStrategy,
  [FeatureOperation.LOFT]: loftStrategy,
  [FeatureOperation.FILLET]: filletStrategy,
  [FeatureOperation.CHAMFER]: chamferStrategy,
  [FeatureOperation.SHELL]: shellStrategy,
  [FeatureOperation.OFFSET]: offsetStrategy,
  [FeatureOperation.MOVE]: transformStrategy,
  [FeatureOperation.ROTATE]: transformStrategy,
  [FeatureOperation.MIRROR]: transformStrategy,
  [FeatureOperation.SCALE]: transformStrategy,
  [FeatureOperation.UNION]: booleanStrategy,
  [FeatureOperation.INTERSECT]: booleanStrategy,
  [FeatureOperation.MEASURE]: measureStrategy,
};
