import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Alert, Checkbox, MultiSelect, Text } from '@mantine/core';
import type { LoftParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const LoftPanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function LoftPanel(
  { project, initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as LoftParams | undefined;
  const closedSketches = project.sketches.filter((s) => s.isClosed);

  const [sketchIds, setSketchIds] = useState<string[]>(p?.sketchIds ?? []);
  const [ruled, setRuled] = useState(!!p?.ruled);

  const isValid = sketchIds.length >= 2;
  useEffect(() => onValidChange(isValid), [isValid, onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      if (!isValid) return;
      onConfirm({ sketchIds, ruled } as LoftParams, sketchIds[0]);
    },
  }));

  if (closedSketches.length < 2) {
    return (
      <Alert color="yellow" title="Need two profiles">
        Create at least two closed sketches to loft between.
      </Alert>
    );
  }

  return (
    <>
      <MultiSelect
        label="Profiles (in order)"
        placeholder="Select 2+ profile sketches"
        value={sketchIds}
        onChange={setSketchIds}
        data={closedSketches.map((s) => ({ value: s.id, label: s.name }))}
        size="sm"
      />
      <Checkbox size="xs" label="Ruled (straight transitions)" checked={ruled} onChange={(e) => setRuled(e.currentTarget.checked)} />
      <Text size="xs" c="dimmed">Lofts a solid through the profiles in the selected order.</Text>
    </>
  );
});
