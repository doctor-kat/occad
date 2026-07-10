import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveWedgeParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const WedgePanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function WedgePanel(
  { initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as PrimitiveWedgeParams | undefined;
  const [width, setWidth] = useState(p?.width ?? 50);
  const [height, setHeight] = useState(p?.height ?? 50);
  const [depth, setDepth] = useState(p?.depth ?? 50);
  const [ltx, setLtx] = useState(p?.ltx ?? 25);

  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => onConfirm({ width, height, depth, ltx, center: { x: 0, y: 0, z: 0 } } as PrimitiveWedgeParams),
  }));

  return (
    <>
      <NumberInput label="Width" value={width} onChange={(val) => setWidth(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Depth" value={depth} onChange={(val) => setDepth(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Top X Length (LTX)" value={ltx} onChange={(val) => setLtx(Number(val))} min={0} size="sm" />
    </>
  );
});
