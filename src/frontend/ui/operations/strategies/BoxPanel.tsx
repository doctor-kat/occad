import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveBoxParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const BoxPanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function BoxPanel(
  { initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as PrimitiveBoxParams | undefined;
  const [width, setWidth] = useState(p?.width ?? 50);
  const [height, setHeight] = useState(p?.height ?? 50);
  const [depth, setDepth] = useState(p?.depth ?? 50);

  // Primitives always have valid defaults.
  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      onConfirm({ width, height, depth, center: { x: 0, y: 0, z: 0 } } as PrimitiveBoxParams);
    },
  }));

  return (
    <>
      <NumberInput label="Width" value={width} onChange={(val) => setWidth(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Depth" value={depth} onChange={(val) => setDepth(Number(val))} min={0.1} size="sm" />
    </>
  );
});
