import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveCylinderParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const CylinderPanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function CylinderPanel(
  { initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as PrimitiveCylinderParams | undefined;
  const [radius, setRadius] = useState(p?.radius ?? 25);
  const [height, setHeight] = useState(p?.height ?? 50);

  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => onConfirm({ radius, height, center: { x: 0, y: 0, z: 0 } } as PrimitiveCylinderParams),
  }));

  return (
    <>
      <NumberInput label="Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
    </>
  );
});
