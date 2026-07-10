import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Alert, Select, Text } from '@mantine/core';
import type { SweepParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const SweepPanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function SweepPanel(
  { project, initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as SweepParams | undefined;
  const closedSketches = project.sketches.filter((s) => s.isClosed);

  const [profileSketchId, setProfileSketchId] = useState(p?.profileSketchId ?? '');
  const [pathSketchId, setPathSketchId] = useState(p?.pathSketchId ?? '');

  const isValid = !!profileSketchId && !!pathSketchId;
  useEffect(() => onValidChange(isValid), [isValid, onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      if (!isValid) return;
      // Pass the profile as the feature's primary sketch (parentIds/edit-resume).
      onConfirm({ profileSketchId, pathSketchId } as SweepParams, profileSketchId);
    },
  }));

  if (closedSketches.length === 0) {
    return (
      <Alert color="yellow" title="No closed sketches">
        Create a closed profile sketch and a path sketch first.
      </Alert>
    );
  }

  return (
    <>
      <Select
        label="Profile (closed)"
        placeholder="Select a profile sketch"
        value={profileSketchId}
        onChange={(value) => setProfileSketchId(value || '')}
        data={closedSketches.map((s) => ({ value: s.id, label: s.name }))}
        size="sm"
      />
      <Select
        label="Path"
        placeholder="Select a path sketch"
        value={pathSketchId}
        onChange={(value) => setPathSketchId(value || '')}
        data={project.sketches.flatMap((s) => (s.id !== profileSketchId ? [{ value: s.id, label: s.name }] : []))}
        size="sm"
      />
      <Text size="xs" c="dimmed">Sweeps the profile along the path.</Text>
    </>
  );
});
