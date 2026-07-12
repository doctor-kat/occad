import {
  CADProject,
  FeatureTreeItem,
  FeatureTreeItemType,
  compareBuildOrder,
  orderKey,
  isRolledBack,
  rollbackIndexForThreshold,
} from '@/cad/types';

/**
 * Build the feature-tree rows for the UI from the project plus any per-item
 * rebuild errors. Pure derivation extracted from useCADState so it can be tested
 * and reused without a React render.
 */
export function buildFeatureTree(
  project: CADProject,
  itemErrors: Record<string, string>
): FeatureTreeItem[] {
  const tree: FeatureTreeItem[] = [];

  // Reference Geometry items always pinned at top
  project.referenceGeometry.forEach((ref) => {
    tree.push({
      id: ref.id,
      name: ref.name,
      type: FeatureTreeItemType.REFERENCE_GEOMETRY,
      visible: ref.isVisible,
      data: ref,
    });
  });

  const sketchIdsUsedByFeatures = new Set(
    project.features.flatMap((f) => (f.sketchId ? [f.sketchId] : []))
  );

  const chronologicalItems: { createdAt: number; item: FeatureTreeItem }[] = [];

  // Standalone sketches (not attached to any feature)
  for (const sketch of project.sketches) {
    if (sketchIdsUsedByFeatures.has(sketch.id)) continue;
    chronologicalItems.push({
      createdAt: sketch.createdAt,
      item: {
        id: sketch.id,
        name: sketch.name,
        type: FeatureTreeItemType.SKETCH,
        visible: sketch.isVisible !== false,
        rolledBack: isRolledBack(sketch, project.rollbackBar),
        error: itemErrors[sketch.id],
        data: sketch,
      },
    });
  }

  // Features (with their sketches as children)
  project.features.forEach((feature) => {
    const associatedSketch = project.sketches.find((s) => s.id === feature.sketchId);
    const featureRolledBack = isRolledBack(feature, project.rollbackBar);
    const featureItem: FeatureTreeItem = {
      id: feature.id,
      name: feature.name,
      type: FeatureTreeItemType.FEATURE,
      isExpanded: feature.isExpanded,
      visible: feature.isVisible !== false,
      rolledBack: featureRolledBack,
      error: itemErrors[feature.id],
      data: feature,
    };

    if (associatedSketch) {
      featureItem.children = [
        {
          id: associatedSketch.id,
          name: associatedSketch.name,
          type: FeatureTreeItemType.SKETCH,
          visible: associatedSketch.isVisible !== false,
          // A consumed sketch greys out with its owning feature.
          rolledBack: featureRolledBack || isRolledBack(associatedSketch, project.rollbackBar),
          error: itemErrors[associatedSketch.id],
          data: associatedSketch,
        },
      ];
    }

    chronologicalItems.push({ createdAt: feature.createdAt, item: featureItem });
  });

  // Sort by the shared deterministic build order so the tree matches the
  // worker's rebuild order exactly and never depends on Array.sort stability.
  chronologicalItems.sort((a, b) => compareBuildOrder(a.item.data as any, b.item.data as any));
  chronologicalItems.forEach(({ item }) => tree.push(item));

  return tree;
}

/**
 * Build-order keys of the top-level tree rows the rollback bar sits between
 * (standalone sketches + features; reference geometry is pinned above and not
 * part of the build order).
 */
export function orderedTopLevelKeys(project: CADProject): number[] {
  const sketchIdsUsedByFeatures = new Set(
    project.features.flatMap((f) => (f.sketchId ? [f.sketchId] : []))
  );
  return [
    ...project.sketches.filter((s) => !sketchIdsUsedByFeatures.has(s.id)),
    ...project.features,
  ]
    .sort(compareBuildOrder)
    .map(orderKey);
}

/**
 * The rollback bar's current position as an index into the top-level rows
 * (0 = above everything, N = below everything / nothing rolled back).
 */
export function rollbackBarIndexOf(project: CADProject): number {
  return rollbackIndexForThreshold(orderedTopLevelKeys(project), project.rollbackBar);
}
