import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput, Text } from '@mantine/core';
import { refLabel, type OffsetParams } from '@/cad/types';
import { useFaceSelection } from './shared/useSubShapeSelection';
import type { OperationPanelHandle, OperationPanelProps } from './types';

/**
 * Offset has no visible face picker — it silently accumulates viewport face
 * clicks (same as the legacy panel) and is always valid; with zero faces
 * selected the operation offsets the whole body.
 */
export const OffsetPanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function OffsetPanel(
  { ctx, initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as OffsetParams | undefined;
  const [distance, setDistance] = useState(p?.distance ?? 10);
  const [selectedFaces] = useFaceSelection(p ? p.faces.map(refLabel) : [], ctx.selectedFaceId);

  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => onConfirm({ distance, faces: selectedFaces } as OffsetParams),
  }));

  return (
    <>
      <NumberInput label="Distance" value={distance} onChange={(val) => setDistance(Number(val))} min={0.1} size="sm" />
      <Text size="xs" c="dimmed">Offset full body by given distance.</Text>
    </>
  );
});
