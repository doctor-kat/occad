import type { FilletParams, ChamferParams, ShellParams, OffsetParams } from '@/cad/types';
import { SubShapeKind } from '@/cad/types';
import { applyFillet } from '../../../modifications/fillet';
import { applyChamfer } from '../../../modifications/chamfer';
import { applyShell } from '../../../modifications/shell';
import { applyOffset } from '../../../modifications/offset';
import { enrichRefs } from '../../../modifications/shared';
import type { FeatureStrategy } from './types';

type TopoDS_Shape = any;

interface ModificationConfig<P> {
  apply: (ctx: any, body: TopoDS_Shape, params: P) => TopoDS_Shape;
  refKey: 'edges' | 'faces';
  subShapeKind: SubShapeKind;
  selection: (params: P) => string[];
}

// Modifications transform the current body in place rather than producing a
// separate solid to boolean-combine. A modification with no body to act on
// (none built yet) is a no-op. Fingerprints are captured against the
// pre-modification body (where the stored indices are valid), pushed only
// after the apply succeeds, so a failed modification doesn't enrich.
function makeModificationStrategy<P>(config: ModificationConfig<P>): FeatureStrategy {
  return ({ ctx, feature, currentBody, refEnrichments }) => {
    if (!currentBody) return { kind: 'noop' };
    const params = feature.parameters as P;
    const enriched = enrichRefs(ctx, currentBody, config.selection(params), config.subShapeKind);
    const body = config.apply(ctx, currentBody, params);
    if (enriched) refEnrichments.push({ featureId: feature.id, key: config.refKey, refs: enriched });
    return { kind: 'replace', body };
  };
}

export const filletStrategy = makeModificationStrategy<FilletParams>({
  apply: applyFillet,
  refKey: 'edges',
  subShapeKind: SubShapeKind.Edge,
  selection: (p) => p.edges,
});

export const chamferStrategy = makeModificationStrategy<ChamferParams>({
  apply: applyChamfer,
  refKey: 'edges',
  subShapeKind: SubShapeKind.Edge,
  selection: (p) => p.edges,
});

export const shellStrategy = makeModificationStrategy<ShellParams>({
  apply: applyShell,
  refKey: 'faces',
  subShapeKind: SubShapeKind.Face,
  selection: (p) => p.faces,
});

export const offsetStrategy = makeModificationStrategy<OffsetParams>({
  apply: applyOffset,
  refKey: 'faces',
  subShapeKind: SubShapeKind.Face,
  selection: (p) => p.faces,
});
