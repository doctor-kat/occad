import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveSphereParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const SpherePanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function SpherePanel(
  { initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as PrimitiveSphereParams | undefined;
  const [radius, setRadius] = useState(p?.radius ?? 25);

  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => onConfirm({ radius, center: { x: 0, y: 0, z: 0 } } as PrimitiveSphereParams),
  }));

  return <NumberInput label="Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />;
});
