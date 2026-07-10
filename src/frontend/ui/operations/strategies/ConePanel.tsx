import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveConeParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const ConePanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function ConePanel(
  { initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as PrimitiveConeParams | undefined;
  const [radius, setRadius] = useState(p?.radius1 ?? 25);
  const [radius2, setRadius2] = useState(p?.radius2 ?? 0);
  const [height, setHeight] = useState(p?.height ?? 50);

  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => onConfirm({ radius1: radius, radius2, height, center: { x: 0, y: 0, z: 0 } } as PrimitiveConeParams),
  }));

  return (
    <>
      <NumberInput label="Base Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Top Radius" value={radius2} onChange={(val) => setRadius2(Number(val))} min={0} size="sm" />
      <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
    </>
  );
});
