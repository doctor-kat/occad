import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { MultiSelect, Text } from '@mantine/core';
import { FeatureOperation, type BooleanParams } from '@/cad/types';
import { useFeatureSelection } from './shared/useSubShapeSelection';
import type { OperationPanelHandle, OperationPanelProps } from './types';

/** Serves both UNION and INTERSECT — the boolean mode is derived from `operation`. */
export const BooleanPanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function BooleanPanel(
  { operation, project, ctx, initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as BooleanParams | undefined;
  const isFeature = (id: string) => project.features.some((f) => f.id === id);
  const [selectedFeatures, setSelectedFeatures] = useFeatureSelection(
    p ? p.featureIds : (ctx.selectedTreeItem && isFeature(ctx.selectedTreeItem) ? [ctx.selectedTreeItem] : []),
    ctx.selectedTreeItem,
    isFeature,
  );

  const isValid = selectedFeatures.length > 0;
  useEffect(() => onValidChange(isValid), [isValid, onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      if (!isValid) return;
      onConfirm({
        operation: operation === FeatureOperation.UNION ? 'union' : 'intersect',
        featureIds: selectedFeatures,
      } as BooleanParams);
    },
  }));

  return (
    <>
      <MultiSelect
        label="Features"
        placeholder="Select features"
        value={selectedFeatures}
        onChange={setSelectedFeatures}
        data={project.features.map((f) => ({ value: f.id, label: f.name }))}
        size="sm"
      />
      <Text size="xs" c="dimmed">Select features in the tree to combine them.</Text>
    </>
  );
});
